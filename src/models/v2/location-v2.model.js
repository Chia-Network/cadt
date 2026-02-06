'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import { LocationV2Mirror } from './location-v2.model.mirror.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class LocationV2 extends Model {
  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LocationV2Mirror.create(values, mirrorOptions);
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
      await LocationV2Mirror.bulkCreate(values, mirrorOptions);
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
      await LocationV2Mirror.update(values, mirrorOptions);
    });
    const result = await super.update(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LocationV2Mirror.upsert(values, mirrorOptions);
    });
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
      await LocationV2Mirror.destroy(mirrorOptions);
    });
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static associate(models) {
    // Location belongs to Project
    LocationV2.belongsTo(models.ProjectV2, {
      foreignKey: 'cadTrustProjectId',
      as: 'project',
    });

    // Note: Other associations will be added when those models are implemented
    // - Location has many Issuances (when Issuance endpoint references location)
  }

  /**
   * Generates changelist from staged data for LocationV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with location changes
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
      (record) => record.table === 'location',
    );
    if (!hasStagedData) {
      return {
        location: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'location');

    const primaryKeyMap = {
      location: 'cad_trust_location_id',
    };

    // PERFORMANCE: Models without children skip getDeletedItems()
    // No child tables, so deletedRecords is always empty

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: LocationV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: LocationV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "LocationV2") to table name (e.g., "location")
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
      location: LocationV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, LocationV2.name, 'location'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, LocationV2.name, 'location'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    return {
      location: [
        ..._.get(insertChangeList, 'location', []),
        ..._.get(updateChangeList, 'location', []),
        ...deleteChangeList,
      ],
    };
  }
}

LocationV2.init(
  {
    cadTrustLocationId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_location_id',
    },
    locationCountry: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'location_country',
    },
    locationRegion: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'location_region',
    },
    locationGis: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'location_gis',
    },
    locationMapType: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'location_map_type',
    },
    locationMapFileLink: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'location_map_file_link',
    },
    cadTrustProjectId: {
      type: Sequelize.STRING(36),
      allowNull: false,
      field: 'cad_trust_project_id',
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'LocationV2',
    tableName: 'location',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { LocationV2 };
