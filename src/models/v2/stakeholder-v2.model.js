'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, mirrorWriteV2 } from '../../database/v2/index.js';
import { StakeholderV2Mirror } from './stakeholder-v2.model.mirror.js';
import ModelTypes from './stakeholder-v2.modeltypes.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class StakeholderV2 extends Model {
  static async create(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderV2Mirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.create(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderV2Mirror.bulkCreate(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.bulkCreate(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderV2Mirror.update(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.update(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderV2Mirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.upsert(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StakeholderV2Mirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.destroy(options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Generates changelist from staged data for StakeholderV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with stakeholder changes
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
      (record) => record.table === 'stakeholder',
    );
    if (!hasStagedData) {
      return {
        stakeholder: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'stakeholder');

    const primaryKeyMap = {
      stakeholder: 'cad_trust_stakeholder_id',
    };

    // PERFORMANCE: Independent models have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: StakeholderV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: StakeholderV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "StakeholderV2") to table name (e.g., "stakeholder")
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
      stakeholder: StakeholderV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, StakeholderV2.name, 'stakeholder'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, StakeholderV2.name, 'stakeholder'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      stakeholder: [
        ..._.get(insertChangeList, 'stakeholder', []),
        ..._.get(updateChangeList, 'stakeholder', []),
        ...deleteChangeList,
      ],
    };
  }
}

StakeholderV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'StakeholderV2',
  tableName: 'stakeholder',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
StakeholderV2.associate = (models) => {
  // Stakeholder has many StakeholderProjects (many-to-many with Project)
  StakeholderV2.hasMany(models.StakeholderProjectV2, {
    foreignKey: 'cadTrustStakeholderId',
    as: 'stakeholderProjects',
  });
};

export { StakeholderV2 };
