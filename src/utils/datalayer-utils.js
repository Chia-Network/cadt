import { CONFIG } from '../user-config';
import { logger } from '../logger.js';

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
    const finalUrl = CONFIG().CHIA.DATALAYER_FILE_SERVER_URL;
    logger.debug(`Resolved Mirror Url: ${finalUrl}`);
    return finalUrl;
  } catch (error) {
    logger.error(`Error getting mirror url: ${error}`);
    return null;
  }
};

/**
 * @param syncStatus {SyncStatus}
 * @returns {boolean}
 */
export const isDlStoreSynced = (syncStatus) => {
  if (syncStatus?.generation && syncStatus?.target_generation) {
    return syncStatus.generation === syncStatus.target_generation;
  }

  return false;
};
