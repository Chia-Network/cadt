'use strict';

import { getConfig } from './config-loader.js';
import datalayer from '../datalayer/index.js';
import { encodeHex, decodeHex } from './datalayer-utils.js';
import { loggerV2 } from '../config/logger.js';
import { OrganizationsV2 } from '../models/v2/index.js';

/**
 * Utility to debug datalayer key mismatches for DELETE operations
 * Compares keys generated during commit with keys that exist in datalayer
 */

/**
 * Get all keys from datalayer for a given store
 * @param {string} storeId - The datalayer store ID
 * @returns {Promise<Array>} Array of keys in datalayer
 */
export const getAllDatalayerKeys = async (storeId) => {
  try {
    // Get root history to find the latest root
    const rootHistory = await datalayer.getRootHistory(storeId);
    if (!rootHistory || rootHistory.length === 0) {
      loggerV2.warn(`[DEBUG] No root history found for storeId: ${storeId}`);
      return [];
    }

    const latestRoot = rootHistory[rootHistory.length - 1];
    loggerV2.debug(`[DEBUG] Latest root hash: ${latestRoot.root_hash}`);

    // Get all keys by getting the diff from genesis to latest root
    // This will show us all keys that currently exist
    const genesisRoot = rootHistory[0];
    const kvDiff = await datalayer.getRootDiff(
      storeId,
      genesisRoot.root_hash,
      latestRoot.root_hash,
    );

    // Filter to only INSERT operations (keys that exist)
    const existingKeys = kvDiff
      .filter((diff) => diff.type === 'INSERT')
      .map((diff) => ({
        hex: diff.key,
        decoded: decodeHex(diff.key),
        type: diff.type,
      }));

    loggerV2.debug(`[DEBUG] Found ${existingKeys.length} keys in datalayer`);
    return existingKeys;
  } catch (error) {
    loggerV2.error(`[DEBUG] Error getting datalayer keys: ${error.message}`);
    throw error;
  }
};

/**
 * Compare a generated DELETE key with keys in datalayer
 * @param {string} storeId - The datalayer store ID
 * @param {string} generatedKey - The key generated during commit (decoded format, e.g., "project_methodology|uuid-uuid")
 * @returns {Promise<Object>} Comparison result
 */
export const compareDeleteKey = async (storeId, generatedKey) => {
  const existingKeys = await getAllDatalayerKeys(storeId);
  const generatedKeyHex = encodeHex(generatedKey);

  // Find exact match
  const exactMatch = existingKeys.find((k) => k.decoded === generatedKey);

  // Find partial matches (same table, different key format)
  const [tablePrefix] = generatedKey.split('|');
  const partialMatches = existingKeys.filter((k) =>
    k.decoded.startsWith(`${tablePrefix}|`),
  );

  return {
    generatedKey,
    generatedKeyHex,
    exactMatch: exactMatch ? exactMatch.decoded : null,
    partialMatches: partialMatches.map((k) => k.decoded),
    allKeysForTable: partialMatches,
  };
};

/**
 * Debug DELETE key generation for a staging record
 * @param {Object} stagingRecord - Staging record with DELETE action
 * @param {string} storeId - The datalayer store ID
 * @returns {Promise<Object>} Debug information
 */
export const debugDeleteKey = async (stagingRecord, storeId) => {
  const { table, action, data, uuid } = stagingRecord;

  if (action !== 'DELETE') {
    throw new Error('This utility is only for DELETE operations');
  }

  loggerV2.debug(`[DEBUG] Debugging DELETE key for staging record:`, {
    uuid,
    table,
    action,
    dataPreview: data ? data.substring(0, 200) : 'null',
  });

  // Parse the staging data to see what primary key fields we have
  let parsedData;
  try {
    parsedData = JSON.parse(data);
    const recordData = Array.isArray(parsedData) ? parsedData[0] : parsedData;
    loggerV2.debug(`[DEBUG] Parsed staging data:`, recordData);

    // Generate the key the same way staging-v2.model.js does
    const { getV2PrimaryKeyField } = await import('./v2-primary-key-utils.js');
    const primaryKeyField = getV2PrimaryKeyField(table);
    loggerV2.debug(`[DEBUG] Primary key field for table ${table}: ${primaryKeyField}`);

    // All tables now use UUID primary keys
    const primaryKeyValue =
      recordData[primaryKeyField] ||
      recordData[
        primaryKeyField.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase(),
        )
      ];
      loggerV2.debug(
        `[DEBUG] Single key (${table}): ${primaryKeyField}=${primaryKeyValue}`,
      );
    }

    const generatedKey = `${table}|${primaryKeyValue}`;
    loggerV2.debug(`[DEBUG] Generated key: ${generatedKey}`);

    // Compare with datalayer
    const comparison = await compareDeleteKey(storeId, generatedKey);

    return {
      stagingRecord: {
        uuid,
        table,
        action,
        data: recordData,
      },
      keyGeneration: {
        primaryKeyField,
        primaryKeyValue,
        generatedKey,
        generatedKeyHex: encodeHex(generatedKey),
      },
      comparison,
    };
  } catch (error) {
    loggerV2.error(`[DEBUG] Error debugging DELETE key: ${error.message}`);
    throw error;
  }
};

/**
 * Debug all DELETE staging records for the home org
 * @param {string} storeId - Optional store ID (if not provided, uses home org)
 * @returns {Promise<Array>} Array of debug information for each DELETE record
 */
export const debugAllDeleteStagingRecords = async (storeId = null) => {
  const { StagingV2 } = await import('../models/v2/index.js');
  let targetStoreId = storeId;

  if (!targetStoreId) {
    const homeOrg = await OrganizationsV2.getHomeOrg();
    if (!homeOrg) {
      throw new Error('No home organization found');
    }
    targetStoreId = homeOrg.registry_id;
  }

  const deleteRecords = await StagingV2.findAll({
    where: {
      action: 'DELETE',
      committed: false,
    },
  });

  loggerV2.info(
    `[DEBUG] Found ${deleteRecords.length} uncommitted DELETE staging records`,
  );

  const debugResults = [];
  for (const record of deleteRecords) {
    try {
      const debugInfo = await debugDeleteKey(record, targetStoreId);
      debugResults.push(debugInfo);
    } catch (error) {
      loggerV2.error(
        `[DEBUG] Error debugging record ${record.uuid}: ${error.message}`,
      );
      debugResults.push({
        stagingRecord: { uuid: record.uuid, table: record.table },
        error: error.message,
      });
    }
  }

  return debugResults;
};







