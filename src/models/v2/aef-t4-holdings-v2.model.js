'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t4-holdings-v2.modeltypes.cjs';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class AefT4HoldingsV2 extends Model {
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
      StagingV2.seperateStagingDataIntoActionGroups(
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
