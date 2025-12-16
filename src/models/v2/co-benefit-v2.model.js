'use strict';

import _ from 'lodash';
import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import StagingV2 from './staging-v2.model.js';
import {
  createXlsFromSequelizeResults,
  transformFullXslsToChangeList,
} from '../../utils/xls.js';
import { keyValueToChangeList } from '../../utils/datalayer-utils.js';
import ModelTypes from './co-benefit-v2.modeltypes.cjs';
import { loggerV2 } from '../../config/logger.js';

class CoBenefitV2 extends Model {
  /**
   * Generates changelist from staged data for CoBenefitV2 model
   * @param {Array} stagedData - Array of staging records
   * @param {string} comment - Comment for the commit
   * @param {string} author - Author of the commit
   * @param {string} registryId - Registry store ID (passed in for performance)
   * @param {boolean} isUpdateComment - Whether comment already exists in datalayer
   * @param {boolean} isUpdateAuthor - Whether author already exists in datalayer
   * @returns {Object} Changelist object with co-benefit changes
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
      (record) => record.table === 'co_benefit',
    );
    if (!hasStagedData) {
      return {
        co_benefit: [],
      };
    }

    const [insertRecords, updateRecords, deleteChangeList] =
      await StagingV2.seperateStagingDataIntoActionGroups(stagedData, 'co_benefit');

    const primaryKeyMap = {
      co_benefit: 'cad_trust_co_benefit_id',
    };

    // PERFORMANCE: Models without children skip getDeletedItems()
    // No child tables, so deletedRecords is always empty

    // Convert records to Excel format (only if records exist)
    const insertXslsSheets =
      insertRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: insertRecords,
            model: CoBenefitV2,
            toStructuredCsv: true,
          })
        : null;

    const updateXslsSheets =
      updateRecords.length > 0
        ? createXlsFromSequelizeResults({
            rows: updateRecords,
            model: CoBenefitV2,
            toStructuredCsv: true,
          })
        : null;

    // Map sheet names from model.name (e.g., "CoBenefitV2") to table name (e.g., "co_benefit")
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
      co_benefit: CoBenefitV2,
    };

    const insertChangeList = insertXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(insertXslsSheets, CoBenefitV2.name, 'co_benefit'),
          'insert',
          primaryKeyMap,
          modelMap,
        )
      : {};

    loggerV2.debug('[v2]: CoBenefitV2 changelist after transform', {
      insertChangeListKeys: Object.keys(insertChangeList),
      insertChangeListCoBenefitCount: _.get(
        insertChangeList,
        'co_benefit',
        [],
      ).length,
      insertChangeListCoBenefit: _.get(insertChangeList, 'co_benefit', []),
    });

    const updateChangeList = updateXslsSheets
      ? await transformFullXslsToChangeList(
          mapSheetNames(updateXslsSheets, CoBenefitV2.name, 'co_benefit'),
          'update',
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
      co_benefit: [
        ..._.get(insertChangeList, 'co_benefit', []),
        ..._.get(updateChangeList, 'co_benefit', []),
        ...deleteChangeList,
      ],
      comment: commentChangeList,
      author: authorChangeList,
    };
  }
}

CoBenefitV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'CoBenefitV2',
  tableName: 'co_benefit',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
CoBenefitV2.associate = (models) => {
  // Co-Benefit belongs to Project
  CoBenefitV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });
};

export { CoBenefitV2 };
