'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, mirrorWriteV2 } from '../../database/v2/index.js';
import { VerificationV2Mirror } from './verification-v2.model.mirror.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class VerificationV2 extends Model {
  static async create(values, options) {
    await mirrorWriteV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await VerificationV2Mirror.create(values, mirrorOptions);
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
      await VerificationV2Mirror.bulkCreate(values, mirrorOptions);
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
      await VerificationV2Mirror.update(values, mirrorOptions);
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
      await VerificationV2Mirror.upsert(values, mirrorOptions);
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
      await VerificationV2Mirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    const result = await super.destroy(options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static associate(models) {
    // Verification belongs to Project
    VerificationV2.belongsTo(models.ProjectV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'project',
    });

    // Verification belongs to Validation
    VerificationV2.belongsTo(models.ValidationV2, {
      foreignKey: 'cadTrustValidationId',
      as: 'validation',
    });

    // Note: Other associations will be added when those models are implemented
    // - Verification has many Issuances
  }

  /**
   * Generates changelist from staged data for VerificationV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with verification changes
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
      (record) => record.table === 'verification',
    );
    if (!hasStagedData) {
      return {
        verification: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'verification');

    const primaryKeyMap = {
      verification: 'cad_trust_verification_id',
    };

    // PERFORMANCE: Models without children skip getDeletedItems()
    // No child tables, so deletedRecords is always empty

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: VerificationV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: VerificationV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "VerificationV2") to table name (e.g., "verification")
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
      verification: VerificationV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, VerificationV2.name, 'verification'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, VerificationV2.name, 'verification'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      verification: [
        ..._.get(insertChangeList, 'verification', []),
        ..._.get(updateChangeList, 'verification', []),
        ...deleteChangeList,
      ],
    };
  }
}

VerificationV2.init(
  {
    cadTrustVerificationId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_verification_id',
    },
    verificationId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'verification_id',
    },
    verificationStartDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'verification_start_date',
    },
    verificationEndDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'verification_end_date',
    },
    verificationBody: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'verification_body',
    },
    cadTrustProjectId: {
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_project_id',
    },
    cadTrustValidationId: {
      type: Sequelize.STRING(36),
      allowNull: true,
      field: 'cad_trust_validation_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'VerificationV2',
    tableName: 'verification',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { VerificationV2 };
