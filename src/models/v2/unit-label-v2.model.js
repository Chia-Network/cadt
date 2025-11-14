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
      StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'unit_label');

    const primaryKeyMap = {
      unit_label: 'id', // Virtual field for composite key
    };

    // PERFORMANCE: Join tables have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: UnitLabelV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: UnitLabelV2,
            toStructuredCsv: true,
          })
        : null;

    // Convert Excel to changelist (only if Excel sheets were created)
    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          insertXslsSheets,
          'insert',
          primaryKeyMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          updateXslsSheets,
          'update',
          primaryKeyMap,
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
  // Define composite primary key
  primaryKey: ['cadTrustLabelId', 'cadTrustUnitId'],
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
