'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t4-holdings-v2.modeltypes.js';
import { AefT4HoldingsV2Mirror } from './aef-t4-holdings-v2.model.mirror.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class AefT4HoldingsV2 extends Model {
  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AefT4HoldingsV2Mirror.create(values, mirrorOptions);
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
      await AefT4HoldingsV2Mirror.bulkCreate(values, mirrorOptions);
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
      await AefT4HoldingsV2Mirror.update(values, mirrorOptions);
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
      await AefT4HoldingsV2Mirror.upsert(values, mirrorOptions);
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
      await AefT4HoldingsV2Mirror.destroy(mirrorOptions);
    });

    const result = await super.destroy(options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Generates changelist from staged data for AefT4HoldingsV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with aef_t4_holdings changes
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
      (record) => record.table === 'aef_t4_holdings',
    );
    if (!hasStagedData) {
      return {
        aef_t4_holdings: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(
        stagedData,
        'aef_t4_holdings',
      );

    const primaryKeyMap = {
      aef_t4_holdings: 'cad_trust_aef_t4_holdings_id',
    };

    // PERFORMANCE: Independent models have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: AefT4HoldingsV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: AefT4HoldingsV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "AefT4HoldingsV2") to table name (e.g., "aef_t4_holdings")
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
      aef_t4_holdings: AefT4HoldingsV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, AefT4HoldingsV2.name, 'aef_t4_holdings'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, AefT4HoldingsV2.name, 'aef_t4_holdings'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      aef_t4_holdings: [
        ..._.get(insertChangeList, 'aef_t4_holdings', []),
        ..._.get(updateChangeList, 'aef_t4_holdings', []),
        ...deleteChangeList,
      ],
    };
  }
}

AefT4HoldingsV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT4HoldingsV2',
  tableName: 'aef_t4_holdings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT4HoldingsV2.associate = (models) => {
  // AEF-T4-Holdings belongs to AEF-T1-Submission
  AefT4HoldingsV2.belongsTo(models.AefT1SubmissionV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'aefT1Submission',
  });

  // AEF-T4-Holdings belongs to Unit
  AefT4HoldingsV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });

  // AEF-T4-Holdings belongs to Project
  AefT4HoldingsV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // AEF-T4-Holdings belongs to AEF-T2-Authorizations
  AefT4HoldingsV2.belongsTo(models.AefT2AuthorizationsV2, {
    foreignKey: 'cadTrustAefT2AuthorizationsId',
    as: 'aefT2Authorizations',
  });
};

export { AefT4HoldingsV2 };
