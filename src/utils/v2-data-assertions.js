'use strict';

import _ from 'lodash';

import { StagingV2 } from '../models/v2/index.js';

/**
 * Enhanced foreign key validation for V2 that checks both main table and staging table
 * This enables users to stage multiple related records in one session before committing
 *
 * @param {Model} Model - The Sequelize model to check
 * @param {string} pk - Primary key value to look for
 * @param {string} pkField - Primary key field name (defaults to model's primary key)
 * @returns {Object} The found record
 * @throws {Error} If record is not found in either main table or staging
 */
export const assertRecordExistanceOrStaged = async (Model, pk, pkField = null) => {
  // Determine the primary key field name
  const primaryKeyField = pkField || Model.primaryKeyAttribute;

  // First check the main table
  const record = await Model.findByPk(pk);
  if (record) {
    return record;
  }

  // If not found in main table, check staging table
  const stagingRecords = await StagingV2.findAll({
    where: {
      table: Model.options.tableName,
      action: ['INSERT', 'UPDATE'],
    },
  });

  // Parse staging data and look for the record
  for (const stagingRecord of stagingRecords) {
    try {
      const stagedData = JSON.parse(stagingRecord.data);

      // Handle both single records and arrays of records
      const recordsToCheck = Array.isArray(stagedData) ? stagedData : [stagedData];

      for (const stagedRecord of recordsToCheck) {
        if (stagedRecord[primaryKeyField] === pk) {
          // Found in staging - return a mock record object
          return {
            ...stagedRecord,
            _isStaged: true,
            _stagingUuid: stagingRecord.uuid,
          };
        }
      }
    } catch (error) {
      // Skip invalid JSON in staging data
      continue;
    }
  }

  // Record not found in either main table or staging
  throw new Error(`${Model.name} does not have a record for ${pk} in main table or staging`);
};

/**
 * Check if a record exists in staging table (for validation purposes)
 *
 * @param {Model} Model - The Sequelize model to check
 * @param {string} pk - Primary key value to look for
 * @param {string} pkField - Primary key field name (defaults to model's primary key)
 * @returns {boolean} True if record exists in staging
 */
export const isRecordStaged = async (Model, pk, pkField = null) => {
  const primaryKeyField = pkField || Model.primaryKeyAttribute;

  const stagingRecords = await StagingV2.findAll({
    where: {
      table: Model.options.tableName,
      action: ['INSERT', 'UPDATE'],
    },
  });

  for (const stagingRecord of stagingRecords) {
    try {
      const stagedData = JSON.parse(stagingRecord.data);
      const recordsToCheck = Array.isArray(stagedData) ? stagedData : [stagedData];

      for (const stagedRecord of recordsToCheck) {
        if (stagedRecord[primaryKeyField] === pk) {
          return true;
        }
      }
    } catch (error) {
      continue;
    }
  }

  return false;
};

/**
 * Get all staged records for a specific table
 *
 * @param {Model} Model - The Sequelize model
 * @returns {Array} Array of staged records
 */
export const getStagedRecords = async (Model) => {
  const stagingRecords = await StagingV2.findAll({
    where: {
      table: Model.options.tableName,
      action: ['INSERT', 'UPDATE'],
    },
  });

  const stagedRecords = [];

  for (const stagingRecord of stagingRecords) {
    try {
      const stagedData = JSON.parse(stagingRecord.data);
      const recordsToCheck = Array.isArray(stagedData) ? stagedData : [stagedData];

      for (const stagedRecord of recordsToCheck) {
        stagedRecords.push({
          ...stagedRecord,
          _isStaged: true,
          _stagingUuid: stagingRecord.uuid,
          _stagingAction: stagingRecord.action,
        });
      }
    } catch (error) {
      continue;
    }
  }

  return stagedRecords;
};

/**
 * V2-specific assertion that staging table is not empty
 *
 * @throws {Error} If staging table is empty
 */
export const assertStagingTableNotEmpty = async () => {
  const stagingCount = await StagingV2.count();
  if (stagingCount === 0) {
    throw new Error('Staging table is empty');
  }
};

/**
 * V2-specific assertion that staging table is empty
 *
 * @throws {Error} If staging table is not empty
 */
export const assertStagingTableIsEmpty = async () => {
  const stagingCount = await StagingV2.count();
  if (stagingCount > 0) {
    throw new Error('Staging table is not empty');
  }
};

/**
 * V2-specific assertion that there are no pending commits excluding transfers
 *
 * @throws {Error} If there are pending commits (excluding transfers)
 */
export const assertNoPendingCommitsExcludingTransfers = async () => {
  const pendingCommits = await StagingV2.count({
    where: {
      commited: false,
      is_transfer: false,
    },
  });

  if (pendingCommits > 0) {
    throw new Error('There are pending commits in staging table');
  }
};
