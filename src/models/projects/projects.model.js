'use strict';

import _ from 'lodash';
import Sequelize from 'sequelize';
import * as rxjs from 'rxjs';
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
  Estimation,
  Rating,
} from '../';

import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls';

import ModelTypes from './projects.modeltypes.cjs';
import { ProjectMirror } from './projects.model.mirror';
import { projectsUpdateSchema } from '../../validations/index';
import { columnsToInclude } from '../../utils/helpers.js';

class Project extends Model {
  static stagingTableName = 'Projects';
  static changes = new rxjs.Subject();
  static defaultColumns = Object.keys(ModelTypes);
  static validateImport = projectsUpdateSchema;
  static virtualFieldList = {};

  static getAssociatedModels = () => [
    {
      model: ProjectLocation,
      pluralize: true,
    },
    {
      model: Label,
      pluralize: true,
    },
    {
      model: Issuance,
      pluralize: true,
    },
    {
      model: CoBenefit,
      pluralize: true,
    },
    {
      model: RelatedProject,
      pluralize: true,
    },
    {
      model: Rating,
      pluralize: true,
    },
    {
      model: Estimation,
      pluralize: true,
    },
  ];

  static associate() {
    Project.hasMany(ProjectLocation, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(Label, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(Issuance, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(CoBenefit, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(RelatedProject, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(Estimation, { foreignKey: 'warehouseProjectId' });
    Project.hasMany(Rating, { foreignKey: 'warehouseProjectId' });

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
      ProjectMirror.hasMany(Estimation, { foreignKey: 'warehouseProjectId' });
      ProjectMirror.hasMany(Rating, { foreignKey: 'warehouseProjectId' });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => ProjectMirror.create(values, options));

    const createResult = await super.create(values, options);

    const { orgUid } = values;

    Project.changes.next(['projects', orgUid]);

    return createResult;
  }

  static async destroy(values, options) {
    safeMirrorDbHandler(() => ProjectMirror.destroy(values, options));

    const record = await super.findOne(values.where);

    if (record) {
      const { orgUid } = record.dataValues;
      Project.changes.next(['projects', orgUid]);
    }

    return super.destroy(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => ProjectMirror.upsert(values, options));
    const upsertResult = await super.upsert(values, options);

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
            !Project.getAssociatedModels()
              .map(
                (association) =>
                  `${association.model.name}${
                    association.pluralize ? 's' : ''
                  }`,
              )
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
        estimatedAnnualAverageEmissionReduction,
        timeStaged
    ) AGAINST ':search' 
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

  static async generateChangeListFromStagedData(stagedData) {
    const [insertRecords, updateRecords, deleteChangeList] =
      Staging.seperateStagingDataIntoActionGroups(stagedData, 'Projects');

    const primaryKeyMap = {
      project: 'warehouseProjectId',
      projectLocations: 'id',
      labels: 'id',
      issuances: 'id',
      coBenefits: 'id',
      relatedProjects: 'id',
      estimations: 'id',
      projectRatings: 'id',
    };

    const deletedRecords = await getDeletedItems(updateRecords, primaryKeyMap);

    const insertXslsSheets = createXlsFromSequelizeResults({
      rows: insertRecords,
      model: Project,
      toStructuredCsv: true,
      excludeOrgUid: false,
    });

    const updateXslsSheets = createXlsFromSequelizeResults({
      rows: updateRecords,
      model: Project,
      toStructuredCsv: true,
      excludeOrgUid: false,
    });

    const deleteXslsSheets = createXlsFromSequelizeResults({
      rows: deletedRecords,
      model: Project,
      toStructuredCsv: true,
      excludeOrgUid: false,
    });

    const insertChangeList = await transformFullXslsToChangeList(
      insertXslsSheets,
      'insert',
      primaryKeyMap,
    );

    const updateChangeList = await transformFullXslsToChangeList(
      updateXslsSheets,
      'update',
      primaryKeyMap,
    );

    const deletedAssociationsChangeList = await transformFullXslsToChangeList(
      deleteXslsSheets,
      'delete',
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
        ..._.get(deletedAssociationsChangeList, 'labels', []),
      ],
      projectLocations: [
        ..._.get(insertChangeList, 'projectLocations', []),
        ..._.get(updateChangeList, 'projectLocations', []),
        ..._.get(deletedAssociationsChangeList, 'projectLocations', []),
      ],
      issuances: [
        ..._.get(insertChangeList, 'issuances', []),
        ..._.get(updateChangeList, 'issuances', []),
        ..._.get(deletedAssociationsChangeList, 'issuances', []),
      ],
      coBenefits: [
        ..._.get(insertChangeList, 'coBenefits', []),
        ..._.get(updateChangeList, 'coBenefits', []),
        ..._.get(deletedAssociationsChangeList, 'coBenefits', []),
      ],
      relatedProjects: [
        ..._.get(insertChangeList, 'relatedProjects', []),
        ..._.get(updateChangeList, 'relatedProjects', []),
        ..._.get(deletedAssociationsChangeList, 'relatedProjects', []),
      ],
      estimations: [
        ..._.get(insertChangeList, 'estimations', []),
        ..._.get(updateChangeList, 'estimations', []),
        ..._.get(deletedAssociationsChangeList, 'estimations', []),
      ],
      projectRatings: [
        ..._.get(insertChangeList, 'projectRatings', []),
        ..._.get(updateChangeList, 'projectRatings', []),
        ..._.get(deletedAssociationsChangeList, 'projectRatings', []),
      ],
    };
  }
}

/**
 * Finds the deleted sub-items (e.g. labels)
 * @param updatedItems {Array} - The projects updated by the user
 * @param primaryKeyMap {Object} - Object map containing the primary keys for all tables
 */
async function getDeletedItems(updatedItems, primaryKeyMap) {
  const updatedProductIds = updatedItems
    .map((record) => record[primaryKeyMap['project']])
    .filter(Boolean);
  const associations = Project.getAssociatedModels();

  let originalProjects = [];
  if (updatedProductIds.length > 0) {
    const columns = [primaryKeyMap['project']].concat(
      associations.map(
        (association) =>
          `${association.model.name}${association.pluralize ? 's' : ''}`,
      ),
    );

    const query = {
      ...columnsToInclude(columns, associations),
    };

    const op = Sequelize.Op;
    originalProjects = await Project.findAll({
      where: {
        [primaryKeyMap['project']]: {
          [op.in]: updatedProductIds,
        },
      },
      ...query,
    });
  }

  const associatedColumns = associations.map(
    (association) =>
      `${association.model.name}${association.pluralize ? 's' : ''}`,
  );

  return originalProjects.map((originalItem) => {
    const result = { ...originalItem.dataValues };

    const updatedItem = updatedItems.find(
      (item) =>
        item[primaryKeyMap['project']] ===
        originalItem[primaryKeyMap['project']],
    );
    if (updatedItem == null) return;

    associatedColumns.forEach((column) => {
      if (originalItem[column] == null || !Array.isArray(originalItem[column]))
        return;
      if (updatedItem[column] == null || !Array.isArray(updatedItem[column]))
        return;

      result[column] = [...originalItem[column]];
      for (let index = originalItem[column].length - 1; index >= 0; --index) {
        const item = originalItem[column][index];
        if (
          updatedItem[column].findIndex(
            (searchedItem) =>
              searchedItem[primaryKeyMap[column]] ===
              item[primaryKeyMap[column]],
          ) >= 0
        )
          result[column].splice(index, 1);
      }
    });
    return result;
  });
}

Project.init(ModelTypes, {
  sequelize,
  modelName: 'project',
  timestamps: true,
});

export { Project };
