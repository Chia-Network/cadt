'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './project-methodology-v2.modeltypes.cjs';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class ProjectMethodologyV2 extends Model {
  /**
   * Generates changelist from staged data for ProjectMethodologyV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with project_methodology changes
   */
  static async generateChangeListFromStagedData(
    stagedData,
    comment,
    author,
    registryId,
    isUpdateComment,
    isUpdateAuthor,
  ) {
    // PERFORMANCE: Early exit if no staged records for this model
    const hasStagedData = stagedData.some(
      (record) => record.table === 'project_methodology',
    );
    if (!hasStagedData) {
      return {
        project_methodology: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      StagingV2.seperateStagingDataIntoActionGroups(
        stagedData,
        'project_methodology',
      );

    const primaryKeyMap = {
      project_methodology: 'id', // Virtual field for composite key
    };

    // PERFORMANCE: Join tables have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: ProjectMethodologyV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: ProjectMethodologyV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "ProjectMethodologyV2") to table name (e.g., "project_methodology")
    // This is needed because createXlsFromSequelizeResults uses model.name as the key,
    // but transformFullXslsToChangeList expects keys matching primaryKeyMap
    const mapSheetNames = (xslsSheets, modelName, tableName) => {
      if (!xslsSheets || !xslsSheets[modelName]) {
        return xslsSheets;
      }
      const mapped = { ...xslsSheets };
      mapped[tableName] = mapped[modelName];
      delete mapped[modelName];
      return mapped;
    };

    // Convert Excel to changelist (only if Excel sheets were created)
    // Pass V2 model map for checking existing records
    const modelMap = {
      project_methodology: ProjectMethodologyV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, ProjectMethodologyV2.name, 'project_methodology'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, ProjectMethodologyV2.name, 'project_methodology'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      project_methodology: [
        ..._.get(insertChangeList, 'project_methodology', []),
        ..._.get(updateChangeList, 'project_methodology', []),
        ...deleteChangeList,
      ],
    };
  }
}

ProjectMethodologyV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'ProjectMethodologyV2',
    tableName: 'project_methodology',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  // Define composite primary key
  primaryKey: ['cadTrustProjectId', 'cadTrustMethodologyId'],
});

// Define associations
ProjectMethodologyV2.associate = (models) => {
  // Project-Methodology belongs to Project
  ProjectMethodologyV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // Project-Methodology belongs to Methodology
  ProjectMethodologyV2.belongsTo(models.MethodologyV2, {
    foreignKey: 'cadTrustMethodologyId',
    as: 'methodology',
  });
};

export { ProjectMethodologyV2 };
