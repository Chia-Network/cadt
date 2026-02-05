'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import { ValidationV2Mirror } from './validation-v2.model.mirror.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class ValidationV2 extends Model {
  static async create(values, options) {
    const result = await super.create(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    const result = await super.bulkCreate(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    const result = await super.update(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ValidationV2Mirror.destroy(mirrorOptions);
    });
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static associate(models) {
    // Validation belongs to Project
    ValidationV2.belongsTo(models.ProjectV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'project',
    });

    // Note: Other associations will be added when those models are implemented
    // - Validation has many Verifications
  }

  /**
   * Generates changelist from staged data for ValidationV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with validation changes
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
      (record) => record.table === 'validation',
    );
    if (!hasStagedData) {
      return {
        validation: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'validation');

    const primaryKeyMap = {
      validation: 'cad_trust_validation_id',
    };

    // PERFORMANCE: Models without children skip getDeletedItems()
    // No child tables, so deletedRecords is always empty

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: ValidationV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: ValidationV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "ValidationV2") to table name (e.g., "validation")
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
      validation: ValidationV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, ValidationV2.name, 'validation'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, ValidationV2.name, 'validation'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      validation: [
        ..._.get(insertChangeList, 'validation', []),
        ..._.get(updateChangeList, 'validation', []),
        ...deleteChangeList,
      ],
    };
  }
}

ValidationV2.init(
  {
    cadTrustValidationId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_validation_id',
    },
    validationId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'validation_id',
    },
    validationType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'validation_type',
    },
    validationBody: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'validation_body',
    },
    validationDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'validation_date',
    },
    validationCreditPeriodStartDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'validation_credit_period_start_date',
    },
    validationCreditPeriodEndDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'validation_credit_period_end_date',
    },
    cadTrustProjectId: {
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_project_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'ValidationV2',
    tableName: 'validation',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { ValidationV2 };
