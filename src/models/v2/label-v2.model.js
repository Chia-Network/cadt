'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import { LabelV2Mirror } from './label-v2.model.mirror.js';
import ModelTypes from './label-v2.modeltypes.cjs';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class LabelV2 extends Model {
  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelV2Mirror.create(values, mirrorOptions);
    });
    const result = await super.create(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelV2Mirror.bulkCreate(values, mirrorOptions);
    });
    const result = await super.bulkCreate(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelV2Mirror.update(values, mirrorOptions);
    });
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
      await LabelV2Mirror.destroy(mirrorOptions);
    });
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Generates changelist from staged data for LabelV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with label changes
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
      (record) => record.table === 'label',
    );
    if (!hasStagedData) {
      return {
        label: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'label');

    const primaryKeyMap = {
      label: 'cad_trust_label_id',
    };

    // PERFORMANCE: Independent models have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: LabelV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: LabelV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "LabelV2") to table name (e.g., "label")
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
      label: LabelV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, LabelV2.name, 'label'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, LabelV2.name, 'label'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      label: [
        ..._.get(insertChangeList, 'label', []),
        ..._.get(updateChangeList, 'label', []),
        ...deleteChangeList,
      ],
    };
  }
}

LabelV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'LabelV2',
  tableName: 'label',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
LabelV2.associate = (models) => {
  // Label has many UnitLabels (many-to-many with Unit)
  LabelV2.hasMany(models.UnitLabelV2, {
    foreignKey: 'cadTrustLabelId',
    as: 'unitLabels',
  });
};

export { LabelV2 };
