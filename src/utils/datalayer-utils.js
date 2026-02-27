import { getConfig } from './config-loader';
import { logger } from '../config/logger.js';

export const encodeHex = (str) => {
  return Buffer.from(str).toString('hex');
};

export const decodeHex = (str = '') => {
  return Buffer.from(str.replace('0x', ''), 'hex').toString('utf8');
};

export const decodeDataLayerResponse = (data) => {
  return data.keys_values.map((item) => ({
    key: decodeHex(item.key),
    value: decodeHex(item.value),
  }));
};

export const keyValueToChangeList = (key, value, includeDelete) => {
  const changeList = [];

  if (includeDelete) {
    changeList.push({
      action: 'delete',
      key: encodeHex(key),
    });
  }

  changeList.push({
    action: 'insert',
    key: encodeHex(key),
    value: encodeHex(value),
  });

  return changeList;
};

export const generateOffer = (maker, taker) => {
  return {
    maker: [
      {
        store_id: maker.storeId,
        inclusions: maker.inclusions,
      },
    ],
    taker: [
      {
        store_id: taker.storeId,
        inclusions: taker.inclusions,
      },
    ],
    fee: 0,
  };
};

export const deserializeTaker = (taker) => {
  const changes = taker[0].inclusions.map((inclusion) => {
    const tableKey = decodeHex(inclusion.key);
    const table = tableKey.split('|')[0];
    const value = JSON.parse(decodeHex(inclusion.value));
    return { table, value };
  });

  return changes;
};

export const deserializeMaker = (maker) => {
  const changes = maker[0].proofs.map((inclusion) => {
    const tableKey = decodeHex(inclusion.key);
    const table = tableKey.split('|')[0];
    const value = JSON.parse(decodeHex(inclusion.value));
    return { table, value };
  });

  return changes;
};

/**
 * Optimizes and sorts an array of key-value differences.
 * NOTE: The only reason this function works is because we treat INSERTS as UPSERTS
 * If that ever changes, this function will need to be removed.
 *
 * @param {Array} kvDiff - An array of objects with { key, type } structure.
 * @returns {Array} - An optimized and sorted array.
 */
export const optimizeAndSortKvDiff = (kvDiff) => {
  const deleteKeys = new Set();
  const insertKeys = new Set();

  // Populate the Sets for quicker lookup
  for (const diff of kvDiff) {
    if (diff.type === 'DELETE') {
      deleteKeys.add(diff.key);
    } else if (diff.type === 'INSERT') {
      insertKeys.add(diff.key);
    }
  }

  // Remove DELETE keys that also exist in INSERT keys
  for (const insertKey of insertKeys) {
    deleteKeys.delete(insertKey);
  }

  // Filter and sort the array based on the optimized DELETE keys
  const filteredArray = kvDiff.filter((diff) => {
    return diff.type !== 'DELETE' || deleteKeys.has(diff.key);
  });

  return filteredArray.sort((a, b) => {
    return a.type === b.type ? 0 : a.type === 'DELETE' ? -1 : 1;
  });
};

export const getMirrorUrl = async () => {
  try {
    const { DATALAYER_FILE_SERVER_URL } = getConfig().APP;
    logger.info(`Resolved Mirror Url: ${DATALAYER_FILE_SERVER_URL}`);
    return DATALAYER_FILE_SERVER_URL;
  } catch {
    logger.error('Error getting DATALAYER_FILE_SERVER_URL: ${error}');
    return null;
  }
};

/**
 * Detects if an owned DataLayer store has lost its local data while on-chain
 * state persists. This happens when the DataLayer database is deleted or reset.
 *
 * Only meaningful for stores owned by this wallet. For subscribed remote stores,
 * generation=0 with target_generation>0 is the normal "still downloading" state.
 *
 * @param {object} syncStatus - The sync_status object from DataLayer's get_sync_status RPC
 * @returns {boolean} true if the store's local data is missing but on-chain data exists
 */
export const isOwnedStoreLocalDataMissing = (syncStatus) => {
  if (!syncStatus) return false;
  const emptyRootHash =
    '0x0000000000000000000000000000000000000000000000000000000000000000';
  return (
    syncStatus.generation === 0 &&
    (syncStatus.root_hash === emptyRootHash ||
      syncStatus.root_hash === emptyRootHash.slice(2)) &&
    syncStatus.target_generation > 0
  );
};

/**
 * @param syncStatus {SyncStatus}
 * @returns {boolean}
 */
export const isDlStoreSynced = (syncStatus) => {
  // Check that both values exist as numbers (including 0)
  // Using != null to allow 0 values (which are falsy but valid)
  if (syncStatus?.generation != null && syncStatus?.target_generation != null) {
    return syncStatus.generation === syncStatus.target_generation;
  }

  return false;
};
