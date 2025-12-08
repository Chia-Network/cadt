'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t2-authorizations-v2.modeltypes.cjs';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class AefT2AuthorizationsV2 extends Model {
  /**
   * Generates changelist from staged data for AefT2AuthorizationsV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with aef_t2_authorizations changes
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
      (record) => record.table === 'aef_t2_authorizations',
    );
    if (!hasStagedData) {
      return {
        aef_t2_authorizations: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      StagingV2.seperateStagingDataIntoActionGroups(
        stagedData,
        'aef_t2_authorizations',
      );

    const primaryKeyMap = {
      aef_t2_authorizations: 'cad_trust_aef_t2_authorizations_id',
    };

    // PERFORMANCE: Independent models have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: AefT2AuthorizationsV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: AefT2AuthorizationsV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "AefT2AuthorizationsV2") to table name (e.g., "aef_t2_authorizations")
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
      aef_t2_authorizations: AefT2AuthorizationsV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, AefT2AuthorizationsV2.name, 'aef_t2_authorizations'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, AefT2AuthorizationsV2.name, 'aef_t2_authorizations'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      aef_t2_authorizations: [
        ..._.get(insertChangeList, 'aef_t2_authorizations', []),
        ..._.get(updateChangeList, 'aef_t2_authorizations', []),
        ...deleteChangeList,
      ],
    };
  }
}

AefT2AuthorizationsV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT2AuthorizationsV2',
  tableName: 'aef_t2_authorizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT2AuthorizationsV2.associate = (models) => {
  // AEF-T2-Authorizations belongs to AEF-T1-Submission
  AefT2AuthorizationsV2.belongsTo(models.AefT1SubmissionV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'aefT1Submission',
  });

  // AEF-T2-Authorizations belongs to Unit
  AefT2AuthorizationsV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });

  // AEF-T2-Authorizations belongs to Project
  AefT2AuthorizationsV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // AEF-T2-Authorizations belongs to AEF-T5-Authorized-Entities
  AefT2AuthorizationsV2.belongsTo(models.AefT5AuthorizedEntitiesV2, {
    foreignKey: 'cadTrustAefT5AuthorizedEntitiesId',
    as: 'aefT5AuthorizedEntities',
  });

  // AEF-T2-Authorizations has many AEF-T3-Actions
  AefT2AuthorizationsV2.hasMany(models.AefT3ActionsV2, {
    foreignKey: 'cadTrustAefT2AuthorizationsId',
    as: 'actions',
  });

  // AEF-T2-Authorizations has many AEF-T4-Holdings
  AefT2AuthorizationsV2.hasMany(models.AefT4HoldingsV2, {
    foreignKey: 'cadTrustAefT2AuthorizationsId',
    as: 'holdings',
  });
};

export { AefT2AuthorizationsV2 };
