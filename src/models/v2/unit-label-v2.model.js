'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './unit-label-v2.modeltypes.cjs';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';
import { loggerV2 } from '../../config/logger.js';

class UnitLabelV2 extends Model {
  /**
   * Generates changelist from staged data for UnitLabelV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with unit_label changes
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
      (record) => record.table === 'unit_label',
    );
    if (!hasStagedData) {
      return {
        unit_label: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'unit_label');

    const primaryKeyMap = {
      unit_label: 'cadTrustUnitLabelId', // Primary key field name (Sequelize camelCase)
    };

    // PERFORMANCE: Join tables have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    // Staging data is in snake_case (database format), but createXlsFromSequelizeResults expects camelCase (Sequelize format)
    const convertedInsertRecords = insertRecords.length > 0
      ? insertRecords.map(record => {
          // Convert snake_case keys to camelCase
          const converted = {};
          for (const key in record) {
            if (record.hasOwnProperty(key)) {
              const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
              converted[camelKey] = record[key];
            }
          }
          // Explicitly ensure primary key is present (handle both formats)
          if (!converted.cadTrustUnitLabelId) {
            converted.cadTrustUnitLabelId = record.cad_trust_unit_label_id || record.cadTrustUnitLabelId;
          }
          if (!converted.cadTrustUnitLabelId) {
            loggerV2.error('[v2]: Missing primary key in unit_label insert record', { record });
            throw new Error('Missing primary key (cadTrustUnitLabelId) in unit_label insert record');
          }
          return converted;
        })
      : [];
    const insertXslsSheets =
      convertedInsertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: convertedInsertRecords,
            model: UnitLabelV2,
            toStructuredCsv: true,
          })
        : null;

    const convertedUpdateRecords = updateRecords.length > 0
      ? updateRecords.map(record => {
          // Convert snake_case keys to camelCase
          const converted = {};
          for (const key in record) {
            if (record.hasOwnProperty(key)) {
              const camelKey = key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
              converted[camelKey] = record[key];
            }
          }
          // Explicitly ensure primary key is present (handle both formats)
          if (!converted.cadTrustUnitLabelId) {
            converted.cadTrustUnitLabelId = record.cad_trust_unit_label_id || record.cadTrustUnitLabelId;
          }
          if (!converted.cadTrustUnitLabelId) {
            loggerV2.error('[v2]: Missing primary key in unit_label update record', { record });
            throw new Error('Missing primary key (cadTrustUnitLabelId) in unit_label update record');
          }
          return converted;
        })
      : [];
    const updateXslsSheets =
      convertedUpdateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: convertedUpdateRecords,
            model: UnitLabelV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "UnitLabelV2") to table name (e.g., "unit_label")
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
      unit_label: UnitLabelV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, UnitLabelV2.name, 'unit_label'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, UnitLabelV2.name, 'unit_label'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      unit_label: [
        ..._.get(insertChangeList, 'unit_label', []),
        ..._.get(updateChangeList, 'unit_label', []),
        ...deleteChangeList,
      ],
    };
  }
}

UnitLabelV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'UnitLabelV2',
  tableName: 'unit_label',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
UnitLabelV2.associate = (models) => {
  // Unit-Label belongs to Label
  UnitLabelV2.belongsTo(models.LabelV2, {
    foreignKey: 'cadTrustLabelId',
    as: 'label',
  });

  // Unit-Label belongs to Unit
  UnitLabelV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });
};

export { UnitLabelV2 };
