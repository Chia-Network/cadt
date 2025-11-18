'use strict';

import _ from 'lodash';

import { StagingV2, OrganizationsV2, MetaV2 } from '../models/v2/index.js';
import { getConfig } from './config-loader.js';

/**
 * V2-specific assertion that the system is not in read-only mode
 *
 * @throws {Error} If system is in read-only mode
 */
export const assertV2IfReadOnlyMode = async () => {
  const { READ_ONLY } = getConfig().APP;
  if (READ_ONLY) {
    throw new Error('You can not use this API in read-only mode');
  }
};

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
 * Checks for records that have been committed (committed: true) but are still
 * waiting for blockchain confirmation. This prevents creating new records
 * when there are already committed records pending.
 *
 * @throws {Error} If there are pending commits (excluding transfers)
 */
export const assertNoPendingCommitsExcludingTransfers = async () => {
  const pendingCommits = await StagingV2.count({
    where: {
      committed: true,
      failed_commit: false,
      is_transfer: false,
    },
  });

  if (pendingCommits > 0) {
    throw new Error('There are pending commits in staging table');
  }
};

/**
 * V2-specific assertion that there are no pending commits (including transfers)
 * Checks for records that have been committed (committed: true) but are still
 * waiting for blockchain confirmation.
 *
 * @throws {Error} If there are any pending commits
 */
export const assertNoPendingCommits = async () => {
  const pendingCommits = await StagingV2.count({
    where: {
      committed: true,
      failed_commit: false,
    },
  });

  if (pendingCommits > 0) {
    throw new Error('There are pending commits in staging table');
  }
};

/**
 * V2-specific assertion that a home organization exists
 * Checks the V2 organizations table for a home organization
 *
 * @throws {Error} If no home organization is found or not subscribed
 * @returns {Object} The home organization record
 */
export const assertV2HomeOrgExists = async () => {
  const homeOrg = await OrganizationsV2.findOne({
    where: { is_home: true },
    raw: true,
  });

  if (!homeOrg) {
    throw new Error(
      `No Home organization found, please create an organization to write data`,
    );
  }

  if (!homeOrg.subscribed) {
    throw new Error(
      `Your Home organization is still confirming, please wait a little longer for it to finish.`,
    );
  }

  return homeOrg;
};

/**
 * V2-specific assertion that an organization UID is valid
 * Checks the V2 organizations table for the given orgUid
 *
 * @param {string} orgUid - The organization UID to validate
 * @param {string} fieldName - The field name for error messages
 * @throws {Error} If orgUid is not found in V2 organizations
 * @returns {Object} The organization map
 */
export const assertV2OrgUidIsValid = async (orgUid, fieldName) => {
  const organizations = await OrganizationsV2.findAll({
    attributes: [
      'org_uid',
      'org_hash',
      'name',
      'icon',
      'is_home',
      'subscribed',
      'synced',
      'file_store_subscribed',
      'registry_id',
      'registry_hash',
      'sync_remaining',
      'data_model_version_store_id',
      'data_model_version_store_hash',
    ],
  });

  const orgsMap = organizations.reduce((map, current) => {
    map[current.org_uid] = current.dataValues;
    return map;
  }, {});

  if (!orgsMap[orgUid]) {
    throw new Error(
      `The orgUid: ${orgUid}, provided for '${fieldName}' is not in the list of subscribed organizations, either remove it or add it to your organizations and try again`,
    );
  }

  return orgsMap;
};

/**
 * V2-specific assertion that the organization is the home organization
 * Checks the V2 organizations table
 *
 * @param {string} orgUid - The organization UID to check
 * @throws {Error} If orgUid is not the home organization
 */
export const assertV2OrgIsHomeOrg = async (orgUid) => {
  const homeOrg = await OrganizationsV2.findOne({
    where: { is_home: true },
    raw: true,
  });

  if (!homeOrg || homeOrg.org_uid !== orgUid) {
    throw new Error(
      `Restricted data: can not modify this record with orgUid ${orgUid}`,
    );
  }
};

/**
 * V2-specific assertion that the instance can be a governance body
 * Checks if IS_GOVERNANCE_BODY is set in config
 *
 * @throws {Error} If IS_GOVERNANCE_BODY is not set
 */
export const assertCanBeGovernanceBodyV2 = async () => {
  const { IS_GOVERNANCE_BODY } = getConfig().APP;
  if (!IS_GOVERNANCE_BODY) {
    throw new Error(
      'You are not an governance body and can not use this functionality',
    );
  }
};

/**
 * V2-specific assertion that the instance is an active governance body
 * Checks MetaV2 for 'governanceBodyId' to verify governance body is set up
 *
 * @throws {Error} If governance body is not set up
 */
export const assertIsActiveGovernanceBodyV2 = async () => {
  const governanceBodyIsSetUp = await MetaV2.findOne({
    where: { meta_key: 'governanceBodyId' },
  });

  if (!governanceBodyIsSetUp) {
    throw new Error(
      'You are not an governance body and can not use this functionality',
    );
  }
};

/**
 * V2-specific assertion that an organization does not exist
 * Checks the V2 organizations table for the given orgUid
 *
 * @param {string} orgUid - The organization UID to check
 * @throws {Error} If orgUid exists in V2 organizations
 */
export const assertV2OrgDoesNotExist = async (orgUid) => {
  const organization = await OrganizationsV2.findOne({
    where: { org_uid: orgUid },
    raw: true,
  });

  if (organization) {
    throw new Error(
      `Organization with orgUid ${orgUid} already exists in V2 database`,
    );
  }
};
