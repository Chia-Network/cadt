'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import { StakeholderProjectV2Mirror } from './stakeholder-projects-v2.model.mirror.js';
import ModelTypes from './stakeholder-projects-v2.modeltypes.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class StakeholderProjectV2 extends Model {
  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderProjectV2Mirror.create(values, mirrorOptions);
    });
    const result = await super.create(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderProjectV2Mirror.bulkCreate(values, mirrorOptions);
    });
    const result = await super.bulkCreate(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderProjectV2Mirror.update(values, mirrorOptions);
    });
    const result = await super.update(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderProjectV2Mirror.upsert(values, mirrorOptions);
    });
    const result = await super.upsert(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderProjectV2Mirror.destroy(mirrorOptions);
    });
    const result = await super.destroy(options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Generates changelist from staged data for StakeholderProjectV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with stakeholder_projects changes
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
      (record) => record.table === 'stakeholder_projects',
    );
    if (!hasStagedData) {
      return {
        stakeholder_projects: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(
        stagedData,
        'stakeholder_projects',
      );

    const primaryKeyMap = {
      stakeholder_projects: 'cad_trust_stakeholder_project_id',
    };

    // PERFORMANCE: Join tables have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: StakeholderProjectV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: StakeholderProjectV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "StakeholderProjectV2") to table name (e.g., "stakeholder_projects")
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
      stakeholder_projects: StakeholderProjectV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, StakeholderProjectV2.name, 'stakeholder_projects'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, StakeholderProjectV2.name, 'stakeholder_projects'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      stakeholder_projects: [
        ..._.get(insertChangeList, 'stakeholder_projects', []),
        ..._.get(updateChangeList, 'stakeholder_projects', []),
        ...deleteChangeList,
      ],
    };
  }
}

StakeholderProjectV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'StakeholderProjectV2',
  tableName: 'stakeholder_projects',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
StakeholderProjectV2.associate = (models) => {
  // Stakeholder-Project belongs to Stakeholder
  StakeholderProjectV2.belongsTo(models.StakeholderV2, {
    foreignKey: 'cadTrustStakeholderId',
    as: 'stakeholder',
  });

  // Stakeholder-Project belongs to Project
  StakeholderProjectV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });
};

export { StakeholderProjectV2 };
