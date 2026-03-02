'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t5-authorized-entities-v2.modeltypes.cjs';
import { AefT5AuthorizedEntitiesV2Mirror } from './aef-t5-authorized-entities-v2.model.mirror.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class AefT5AuthorizedEntitiesV2 extends Model {
  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await AefT5AuthorizedEntitiesV2Mirror.create(values, mirrorOptions);
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
      await AefT5AuthorizedEntitiesV2Mirror.bulkCreate(values, mirrorOptions);
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
      await AefT5AuthorizedEntitiesV2Mirror.update(values, mirrorOptions);
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
      await AefT5AuthorizedEntitiesV2Mirror.upsert(values, mirrorOptions);
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
      await AefT5AuthorizedEntitiesV2Mirror.destroy(mirrorOptions);
    });

    const result = await super.destroy(options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Generates changelist from staged data for AefT5AuthorizedEntitiesV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with aef_t5_authorized_entities changes
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
      (record) => record.table === 'aef_t5_authorized_entities',
    );
    if (!hasStagedData) {
      return {
        aef_t5_authorized_entities: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(
        stagedData,
        'aef_t5_authorized_entities',
      );

    const primaryKeyMap = {
      aef_t5_authorized_entities: 'cad_trust_aef_t5_authorized_entities_id',
    };

    // PERFORMANCE: Independent models have no child tables, so skip getDeletedItems()

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: AefT5AuthorizedEntitiesV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: AefT5AuthorizedEntitiesV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "AefT5AuthorizedEntitiesV2") to table name (e.g., "aef_t5_authorized_entities")
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
      aef_t5_authorized_entities: AefT5AuthorizedEntitiesV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, AefT5AuthorizedEntitiesV2.name, 'aef_t5_authorized_entities'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, AefT5AuthorizedEntitiesV2.name, 'aef_t5_authorized_entities'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      aef_t5_authorized_entities: [
        ..._.get(insertChangeList, 'aef_t5_authorized_entities', []),
        ..._.get(updateChangeList, 'aef_t5_authorized_entities', []),
        ...deleteChangeList,
      ],
    };
  }
}

AefT5AuthorizedEntitiesV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT5AuthorizedEntitiesV2',
  tableName: 'aef_t5_authorized_entities',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT5AuthorizedEntitiesV2.associate = (models) => {
  // AEF-T5-Authorized-Entities belongs to AEF-T1-Submission
  AefT5AuthorizedEntitiesV2.belongsTo(models.AefT1SubmissionV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'aefT1Submission',
  });

  // AEF-T5-Authorized-Entities belongs to Unit
  AefT5AuthorizedEntitiesV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });

  // AEF-T5-Authorized-Entities belongs to Project
  AefT5AuthorizedEntitiesV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // AEF-T5-Authorized-Entities has many AEF-T2-Authorizations
  AefT5AuthorizedEntitiesV2.hasMany(models.AefT2AuthorizationsV2, {
    foreignKey: 'cadTrustAefT5AuthorizedEntitiesId',
    as: 'authorizations',
  });

  // AEF-T5-Authorized-Entities associations will be added when AEF-T2-Authorizations is implemented
  // AefT5AuthorizedEntitiesV2.belongsTo(models.AefT2AuthorizationsV2, {
  //   foreignKey: 'cadTrustAefT2AuthorizationsId',
  //   as: 'aefT2Authorizations',
  // });
};

export { AefT5AuthorizedEntitiesV2 };
