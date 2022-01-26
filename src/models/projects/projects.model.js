'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
import rxjs from 'rxjs';
const { Model } = Sequelize;

import {
  sequelize,
  safeMirrorDbHandler,
  sanitizeSqliteFtsQuery,
} from '../database';

import {
  RelatedProject,
  Issuance,
  Label,
  ProjectLocation,
  CoBenefit,
  Staging,
} from '../';

import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';

import ModelTypes from './projects.modeltypes.cjs';
import { ProjectMirror } from './projects.model.mirror';

class Project extends Model {
  static stagingTableName = 'Projects';
  static changes = new rxjs.Subject();
  static defaultColumns = Object.keys(ModelTypes);
  static getAssociatedModels = () => [
    ProjectLocation,
    Label,
    Issuance,
    CoBenefit,
    RelatedProject,
  ];

  static associate() {
    Project.hasMany(ProjectLocation, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(Label, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(Issuance, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(CoBenefit, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(RelatedProject, { foreignKey: 'warehouseProjectId' });

    safeMirrorDbHandler(() => {
      ProjectMirror.hasMany(ProjectLocation, {
        foreignKey: 'warehouseProjectId',
      });
      ProjectMirror.hasMany(Label, {
        foreignKey: 'warehouseProjectId',
      });
      ProjectMirror.hasMany(Issuance, { foreignKey: 'warehouseProjectId' });
      ProjectMirror.hasMany(CoBenefit, { foreignKey: 'warehouseProjectId' });
      ProjectMirror.hasMany(RelatedProject, {
        foreignKey: 'warehouseProjectId',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => ProjectMirror.create(values, options));

    const createResult = await super.create(values, options);

    const { orgUid } = values;

    Project.changes.next(['projects', orgUid]);

    return createResult;
  }

  static async destroy(values) {
    safeMirrorDbHandler(() => ProjectMirror.destroy(values));

    const record = await super.findOne(values.where);

    if (record) {
      const { orgUid } = record.dataValues;
      Project.changes.next(['projects', orgUid]);
    }

    return super.destroy(values);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => ProjectMirror.create(values, options));
    const upsertResult = await super.create(values, options);

    const { orgUid } = values;

    Project.changes.next(['projects', orgUid]);

    return upsertResult;
  }

  static async fts(searchStr, orgUid, pagination, columns = []) {
    const dialect = sequelize.getDialect();

    const handlerMap = {
      sqlite: Project.findAllSqliteFts,
      mysql: Project.findAllMySQLFts,
    };

    return handlerMap[dialect](
      searchStr,
      orgUid,
      pagination,
      columns
        .filter((col) => !['createdAt', 'updatedAt'].includes(col))
        .filter(
          (col) =>
            ![ProjectLocation, Label, Issuance, CoBenefit, RelatedProject]
              .map((model) => model.name + 's')
              .includes(col),
        ),
    );
  }

  static async findAllMySQLFts(searchStr, orgUid, pagination, columns = []) {
    const { offset, limit } = pagination;

    let fields = '*';
    if (columns.length) {
      fields = columns.join(', ');
    }

    let sql = `
    SELECT ${fields} FROM projects WHERE MATCH (
        warehouseProjectId,
        currentRegistry,
        registryOfOrigin,
        program,
        projectName,
        projectLink,
        projectDeveloper,
        sector,
        projectType,
        NDCLinkage,
        projectStatus,
        unitMetric,
        methodology,
        methodologyVersion,
        validationApproach,
        projectTag,
        estimatedAnnualAverageEmissionReduction
    ) AGAINST ":search"
    `;

    if (orgUid) {
      sql = `${sql} AND orgUid = :orgUid`;
    }

    const replacements = { search: searchStr, orgUid };

    const count = (
      await sequelize.query(sql, {
        model: Project,
        mapToModel: true, // pass true here if you have any mapped fields
        replacements,
      })
    ).length;

    if (limit && offset) {
      sql = `${sql} ORDER BY relevance DESC LIMIT :limit OFFSET :offset`;
    }

    return {
      count,
      rows: await sequelize.query(sql, {
        model: Project,
        replacements: { ...replacements, ...{ offset, limit } },
        mapToModel: true, // pass true here if you have any mapped fields
        offset,
        limit,
      }),
    };
  }

  static async findAllSqliteFts(searchStr, orgUid, pagination, columns = []) {
    const { offset, limit } = pagination;

    let fields = '*';
    if (columns.length) {
      fields = columns.join(', ');
    }

    searchStr = sanitizeSqliteFtsQuery(searchStr);

    if (searchStr === '*') {
      // * isn't a valid matcher on its own. return empty set
      return {
        count: 0,
        rows: [],
      };
    }

    if (searchStr.startsWith('+')) {
      searchStr = searchStr.replace('+', ''); // If query starts with +, replace it
    }

    let sql = `SELECT ${fields} FROM projects_fts WHERE projects_fts MATCH :search`;

    if (orgUid) {
      sql = `${sql} AND orgUid = :orgUid`;
    }

    const replacements = { search: searchStr, orgUid };

    const count = (
      await sequelize.query(sql, {
        model: Project,
        mapToModel: true, // pass true here if you have any mapped fields
        replacements,
      })
    ).length;

    if (limit && offset) {
      sql = `${sql} ORDER BY rank DESC LIMIT :limit OFFSET :offset`;
    }

    return {
      count,
      rows: await sequelize.query(sql, {
        model: Project,
        mapToModel: true, // pass true here if you have any mapped fields
        replacements: { ...replacements, ...{ offset, limit } },
      }),
    };
  }

  static generateChangeListFromStagedData(stagedData) {
    const [insertRecords, updateRecords, deleteChangeList] =
      Staging.seperateStagingDataIntoActionGroups(stagedData, 'Projects');

    const insertXslsSheets = createXlsFromSequelizeResults(
      insertRecords,
      Project,
      false,
      true,
    );

    const updateXslsSheets = createXlsFromSequelizeResults(
      updateRecords,
      Project,
      false,
      true,
    );

    const primaryKeyMap = {
      project: 'warehouseProjectId',
      projectLocations: 'id',
      labels: 'id',
      issuances: 'id',
      coBenefits: 'id',
      relatedProjects: 'id',
    };

    const insertChangeList = transformFullXslsToChangeList(
      insertXslsSheets,
      'insert',
      primaryKeyMap,
    );

    const updateChangeList = transformFullXslsToChangeList(
      updateXslsSheets,
      'update',
      primaryKeyMap,
    );

    return {
      projects: [
        ..._.get(insertChangeList, 'project', []),
        ..._.get(updateChangeList, 'project', []),
        ...deleteChangeList,
      ],
      labels: [
        ..._.get(insertChangeList, 'labels', []),
        ..._.get(updateChangeList, 'labels', []),
      ],
      projectLocations: [
        ..._.get(insertChangeList, 'projectLocations', []),
        ..._.get(updateChangeList, 'projectLocations', []),
      ],
      issuances: [
        ..._.get(insertChangeList, 'issuances', []),
        ..._.get(updateChangeList, 'issuances', []),
      ],
      coBenefits: [
        ..._.get(insertChangeList, 'coBenefits', []),
        ..._.get(updateChangeList, 'coBenefits', []),
      ],
      relatedProjects: [
        ..._.get(insertChangeList, 'relatedProjects', []),
        ..._.get(updateChangeList, 'relatedProjects', []),
      ],
    };
  }
}

Project.init(ModelTypes, {
  sequelize,
  modelName: 'project',
  timestamps: true,
});

export { Project };
