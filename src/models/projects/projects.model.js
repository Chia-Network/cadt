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
  Vintage,
  Qualification,
  ProjectLocation,
  CoBenefit,
  Rating,
} from '../';

import { changeListFactory } from '../../fullnode/data-layer-utils';

import ModelTypes from './projects.modeltypes.cjs';
import { ProjectMirror } from './projects.model.mirror';

class Project extends Model {
  static stagingTableName = 'Projects';
  static changes = new rxjs.Subject();
  static defaultColumns = Object.keys(ModelTypes);
  static getAssociatedModels = () => [
    ProjectLocation,
    Qualification,
    Vintage,
    CoBenefit,
    RelatedProject,
  ];

  static associate() {
    Project.hasMany(ProjectLocation, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(Qualification, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(Vintage, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(CoBenefit, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(RelatedProject, { foreignKey: 'warehouseProjectId' });

    safeMirrorDbHandler(() => {
      ProjectMirror.hasMany(ProjectLocation, {
        foreignKey: 'warehouseProjectId',
      });
      ProjectMirror.hasMany(Qualification, {
        foreignKey: 'warehouseProjectId',
      });
      ProjectMirror.hasMany(Vintage, { foreignKey: 'warehouseProjectId' });
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
    const { orgUid } = record.dataValues;

    Project.changes.next(['projects', orgUid]);

    return super.destroy(values);
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
            ![
              ProjectLocation,
              Qualification,
              Vintage,
              CoBenefit,
              RelatedProject,
            ]
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

  static async generateChangeListFromStagedData(
    action,
    warehouseProjectId,
    stagedData,
  ) {
    const foreignKeys = [
      'projectLocations',
      'qualifications',
      'vintages',
      'coBenefits',
      'relatedProjects',
    ];

    return Promise.resolve(
      changeListFactory(
        action,
        warehouseProjectId,
        _.omit(stagedData, foreignKeys),
      ),
    );
  }

  static async generateFullProjectModelChangeListFromStagedRecord(data) {
    const promises = [Project.generateChangeListFromStagedData(data)];

    if (data.projectLocations) {
      promises.push(
        ProjectLocation.generateChangeListFromStagedData(data.projectLocations),
      );
    }

    if (data.qualifications) {
      promises.push(
        Qualification.generateChangeListFromStagedData(data.qualifications),
      );
    }

    if (data.relatedProjects) {
      promises.push(
        Rating.generateChangeListFromStagedData(data.relatedProjects),
      );
    }

    if (data.coBenefits) {
      promises.push(
        CoBenefit.generateChangeListFromStagedData(data.coBenefits),
      );
    }

    if (data.vintages) {
      promises.push(Vintage.generateChangeListFromStagedData(data.vintages));
    }

    if (data.relatedProjects) {
      promises.push(
        RelatedProject.generateChangeListFromStagedData(data.relatedProjects),
      );
    }

    return Promise.all(promises);
  }
}

Project.init(ModelTypes, {
  sequelize,
  modelName: 'project',
});

export { Project };
