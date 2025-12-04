'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './methodology-v2.modeltypes.cjs';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';
import { loggerV2 } from '../../config/logger.js';

class MethodologyV2 extends Model {
  /**
   * Generates changelist from staged data for MethodologyV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with methodology changes
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
      (record) => record.table === 'methodology',
    );
    if (!hasStagedData) {
      return {
        methodology: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'methodology');

    loggerV2.debug('[v2]: MethodologyV2 changelist generation', {
      insertRecordsCount: insertRecords.length,
      updateRecordsCount: updateRecords.length,
      deleteChangeListCount: deleteChangeList.length,
      insertRecordsSample: insertRecords.length > 0 ? insertRecords[0] : null,
    });

    const primaryKeyMap = {
      methodology: 'cad_trust_methodology_id',
    };

    // PERFORMANCE: Models without children skip getDeletedItems()
    // No child tables, so deletedRecords is always empty

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: MethodologyV2,
            toStructuredCsv: true,
          })
        : null;

    loggerV2.debug('[v2]: MethodologyV2 Excel sheets created', {
      insertXslsSheets: insertXslsSheets ? 'created' : 'null',
      insertXslsSheetsKeys: insertXslsSheets ? Object.keys(insertXslsSheets) : [],
      insertXslsSheetsContent: insertXslsSheets
        ? {
            sheetName: Object.keys(insertXslsSheets)[0],
            sheetData: insertXslsSheets[Object.keys(insertXslsSheets)[0]]?.data,
          }
        : null,
      primaryKeyMap,
      expectedKey: 'methodology',
    });

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: MethodologyV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "MethodologyV2") to table name (e.g., "methodology")
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
      methodology: MethodologyV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, MethodologyV2.name, 'methodology'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    loggerV2.debug('[v2]: MethodologyV2 changelist after transform', {
      insertChangeListKeys: Object.keys(insertChangeList),
      insertChangeListMethodologyCount: _.get(
        insertChangeList,
        'methodology',
        [],
      ).length,
      insertChangeListMethodology: _.get(insertChangeList, 'methodology', []),
    });

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, MethodologyV2.name, 'methodology'),
          'update',
          primaryKeyMap,
          modelMap,
        )
      : {};

    const finalChangelist = {
      methodology: [
        ..._.get(insertChangeList, 'methodology', []),
        ..._.get(updateChangeList, 'methodology', []),
        ...deleteChangeList,
      ],
    };

    loggerV2.debug('[v2]: MethodologyV2 final changelist', {
      finalChangelistSize: finalChangelist.methodology.length,
      finalChangelist: finalChangelist.methodology,
    });

    return finalChangelist;
  }
}

MethodologyV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'MethodologyV2',
  tableName: 'methodology',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export { MethodologyV2 };
