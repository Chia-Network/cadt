'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t1-submission-v2.modeltypes.cjs';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class AefT1SubmissionV2 extends Model {
  /**
   * Generates changelist from staged data for AefT1SubmissionV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with aef_t1_submission changes
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
      (record) => record.table === 'aef_t1_submission',
    );
    if (!hasStagedData) {
      return {
        aef_t1_submission: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(
        stagedData,
        'aef_t1_submission',
      );

    const primaryKeyMap = {
      aef_t1_submission: 'cad_trust_aef_t1_submission_id',
    };

    // PERFORMANCE: Independent models have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: AefT1SubmissionV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: AefT1SubmissionV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "AefT1SubmissionV2") to table name (e.g., "aef_t1_submission")
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
      aef_t1_submission: AefT1SubmissionV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, AefT1SubmissionV2.name, 'aef_t1_submission'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, AefT1SubmissionV2.name, 'aef_t1_submission'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      aef_t1_submission: [
        ..._.get(insertChangeList, 'aef_t1_submission', []),
        ..._.get(updateChangeList, 'aef_t1_submission', []),
        ...deleteChangeList,
      ],
    };
  }
}

AefT1SubmissionV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT1SubmissionV2',
  tableName: 'aef_t1_submission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT1SubmissionV2.associate = (models) => {
  // AEF-T1-Submission has many AEF-T5-Authorized-Entities
  AefT1SubmissionV2.hasMany(models.AefT5AuthorizedEntitiesV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'authorizedEntities',
  });

  // AEF-T1-Submission associations will be added when other AEF models are implemented
  // AefT1SubmissionV2.hasMany(models.AefT2AuthorizationsV2, {
  //   foreignKey: 'cadTrustAefT1SubmissionId',
  //   as: 'authorizations',
  // });
  // AefT1SubmissionV2.hasMany(models.AefT3ActionsV2, {
  //   foreignKey: 'cadTrustAefT1SubmissionId',
  //   as: 'actions',
  // });
  // AefT1SubmissionV2.hasMany(models.AefT4HoldingsV2, {
  //   foreignKey: 'cadTrustAefT1SubmissionId',
  //   as: 'holdings',
  // });
};

export { AefT1SubmissionV2 };
