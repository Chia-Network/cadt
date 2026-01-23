'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';
import { getDeletedItems } from '../../utils/model-utils.js';
import { keyValueToChangeList } from '../../utils/datalayer-utils.js';
import { UnitV2 } from './unit-v2.model.js';

class IssuanceV2 extends Model {
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
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static associate(models) {
    // Issuance belongs to Verification
    IssuanceV2.belongsTo(models.VerificationV2, {
      foreignKey: 'cadTrustVerificationId',
      as: 'verification',
    });

    // Issuance belongs to ProjectMethodology
    IssuanceV2.belongsTo(models.ProjectMethodologyV2, {
      foreignKey: 'cadTrustProjectMethodologyId',
      as: 'projectMethodology',
    });

    // Issuance has many Units
    IssuanceV2.hasMany(models.UnitV2, {
      foreignKey: 'cadTrustIssuanceId',
      as: 'units',
    });

    // Note: LocationV2 association will be added when Location endpoint is implemented
    // Issuance belongs to Location (optional)
    // IssuanceV2.belongsTo(models.LocationV2, {
    //   foreignKey: 'cadTrustLocationId',
    //   as: 'location',
    // });
  }

  /**
   * Returns associated models for IssuanceV2
   * Used by getDeletedItems to identify child records
   * @returns {Array} Array of associated model objects
   */
  static getAssociatedModels = () => [{ model: UnitV2, pluralize: true }];

  /**
   * Generates changelist from staged data for IssuanceV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with issuance and child table changes
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
      (record) => record.table === 'issuance',
    );
    if (!hasStagedData) {
      return {
        issuance: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'issuance');

    const primaryKeyMap = {
      issuance: 'cad_trust_issuance_id',
    };

    // PERFORMANCE: Only call getDeletedItems() if UPDATE records exist
    const deletedRecords =
      updateRecords.length > 0
        ? await getDeletedItems(
            updateRecords,
            primaryKeyMap,
            IssuanceV2,
            'issuance',
          )
        : [];

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: IssuanceV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: IssuanceV2,
            toStructuredCsv: true,
          })
        : null;

    const deleteXslsSheets =
      deletedRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: deletedRecords,
            model: IssuanceV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "IssuanceV2") to table name (e.g., "issuance")
    // This is needed because createXlsFromSequelizeResults uses model.name as the key,
    // but transformFullXslsToChangeList expects keys matching primaryKeyMap
    // Also map child table sheet names if they exist
    const mapSheetNames = (xslsSheets, modelName, tableName) => {
      if (!xslsSheets) {
        return xslsSheets;
      }
      const mapped = { ...xslsSheets };
      if (mapped[modelName]) {
        mapped[tableName] = mapped[modelName];
        delete mapped[modelName];
      }
      return mapped;
    };

    // Convert Excel to changelist (only if Excel sheets were created)
    // Pass V2 model map for checking existing records
    const modelMap = {
      issuance: IssuanceV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, IssuanceV2.name, 'issuance'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, IssuanceV2.name, 'issuance'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const deletedAssociationsChangeList = deleteXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(deleteXslsSheets, IssuanceV2.name, 'issuance'),
          'delete',
          primaryKeyMap,
          modelMap,
        )
      : {};

    // PERFORMANCE: Use passed-in metadata instead of fetching
    // Generate comment and author changelist (only from first model that processes it)
    const commentChangeList = keyValueToChangeList(
      'comment',
      `{"comment": "${comment}"}`,
      isUpdateComment,
    );

    const authorChangeList = keyValueToChangeList(
      'author',
      `{"author": "${author}"}`,
      isUpdateAuthor,
    );

    return {
      issuance: [
        ..._.get(insertChangeList, 'issuance', []),
        ..._.get(updateChangeList, 'issuance', []),
        ...deleteChangeList,
      ],
      comment: commentChangeList,
      author: authorChangeList,
    };
  }
}

IssuanceV2.init(
  {
    cadTrustIssuanceId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_issuance_id',
    },
    issuanceId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'issuance_id',
    },
    issuanceDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'issuance_date',
    },
    cadTrustVerificationId: {
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_verification_id',
    },
    cadTrustProjectMethodologyId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'cad_trust_project_methodology_id',
    },
    cadTrustLocationId: {
      type: Sequelize.STRING(36),
      allowNull: true,
      field: 'cad_trust_location_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'IssuanceV2',
    tableName: 'issuance',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { IssuanceV2 };
