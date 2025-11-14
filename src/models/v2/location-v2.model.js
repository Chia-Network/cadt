'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';

class LocationV2 extends Model {
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
      StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'location');

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
