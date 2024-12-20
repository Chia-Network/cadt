import _ from 'lodash';

import { decodeDataLayerResponse } from '../utils/datalayer-utils';
import { Simulator } from '../models';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.js';

import * as dataLayer from './persistance';
import * as simulator from './simulator';

const { USE_SIMULATOR } = getConfig().APP;

const POLLING_INTERVAL = 5000;

const unsubscribeFromDataLayerStore = async (storeId) => {
  if (!USE_SIMULATOR) {
    return dataLayer.unsubscribeFromDataLayerStore(storeId);
  }
};

const unsubscribeFromDataLayerStoreWithRetry = async (
  storeId,
  maxRetries = 60,
  retryWaitMs = 600,
) => {
  if (!USE_SIMULATOR) {
    let success = false;
    let retryCount = 0;

    while (!success) {
      success = await dataLayer.unsubscribeFromDataLayerStore(storeId);
      if (!success) {
        if (retryCount >= maxRetries) {
          throw new Error(
            `failed to unsubscribe from store ${storeId} after ${maxRetries} attempts`,
          );
        }
        await new Promise((resolve) => setTimeout(() => resolve, retryWaitMs));
      }
    }
  }
};

const subscribeToStoreOnDataLayer = async (storeId) => {
  if (USE_SIMULATOR) {
    return simulator.subscribeToStoreOnDataLayer(storeId);
  } else {
    return dataLayer.subscribeToStoreOnDataLayer(storeId);
  }
};

/**
 * gets and decodes data from a subscribed store.
 * will subscribe to any store id for which there is no subscription.
 * @param storeId to retrieve data from
 * @returns {Promise<any>}
 */
const getSubscribedStoreData = async (storeId) => {
  const { storeIds: subscriptions, success } =
    await dataLayer.getSubscriptions();
  if (!success) {
    throw new Error('failed to retrieve subscriptions from datalayer');
  }
  const alreadySubscribed = subscriptions.includes(storeId);

  if (!alreadySubscribed) {
    logger.info(`No Subscription Found for ${storeId}, Subscribing...`);
    const response = await dataLayer.subscribeToStoreOnDataLayer(storeId);

    if (!response) {
      throw new Error(`Failed to subscribe to ${storeId}`);
    }
  }

  logger.debug(`Subscription Found for ${storeId}.`);

  if (!USE_SIMULATOR) {
    logger.debug(
      `syncService getSubscribedData() checking that data is available for ${storeId}.`,
    );
    const { confirmed } = await dataLayer.getRoot(storeId);
    if (!confirmed) {
      throw new Error(
        `${storeId} has not yet been confirmed. cannot get root.`,
      );
    } else {
      logger.debug(
        `store data is confirmed available, proceeding to get data ${storeId}`,
      );
    }
  }

  let encodedData;
  if (USE_SIMULATOR) {
    encodedData = await simulator.getStoreData(storeId);
  } else {
    encodedData = await dataLayer.getStoreData(storeId);
  }

  if (_.isEmpty(encodedData?.keys_values)) {
    throw new Error(
      `getSubscribedStoreData() found no data for store ${storeId}`,
    );
  }

  const decodedData = decodeDataLayerResponse(encodedData);

  return decodedData.reduce((obj, current) => {
    obj[current.key] = current.value;
    return obj;
  }, {});
};

const getRootHistory = (storeId) => {
  if (!USE_SIMULATOR) {
    return dataLayer.getRootHistory(storeId);
  } else {
    return [
      {
        confirmed: true,
        root_hash:
          '0xs571e7fcf464b3dc1d31a71894633eb47cb9dbdb824f6b4a535ed74f23f32e50',
        timestamp: 1678518050,
      },
      {
        confirmed: true,
        root_hash:
          '0xf571e7fcf464b3dc1d31a71894633eb47cb9dbdb824f6b4a535ed74f23f32e50',
        timestamp: 1678518053,
      },
    ];
  }
};

const getRootDiff = (storeId, root1, root2) => {
  if (USE_SIMULATOR) {
    return Simulator.getMockedKvDiffFromStagingTable();
  } else {
    return dataLayer.getRootDiff(storeId, root1, root2);
  }
};

/**
 * Fetches store data and invokes either a callback or an error handler.
 *
 * @param {string} storeId - The ID of the store to fetch data for.
 * @param {Function} callback - Function to call on successful data retrieval.
 * @param {Function} onFail - Function to call when data retrieval fails.
 * @param {number} retry - Number of retry attempts.
 */
const getStoreData = async (storeId, callback, onFail, rootHash, retry = 0) => {
  const MAX_RETRIES = 6;
  const RETRY_DELAY = 10000;

  try {
    logger.info(`Getting store data, retry: ${retry}`);

    if (retry > MAX_RETRIES) {
      return onFail(`Max retries exceeded for store ${storeId}`);
    }

    const encodedData = await dataLayer.getStoreData(storeId, rootHash);

    if (!encodedData || _.isEmpty(encodedData?.keys_values)) {
      logger.debug(`No data found for store ${storeId}, retrying...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return getStoreData(storeId, callback, onFail, rootHash, retry + 1);
    }

    const decodedData = decodeDataLayerResponse(encodedData);

    callback(decodedData);
  } catch (error) {
    logger.error(error.message);
    onFail(error.message);
  }
};

const getCurrentStoreData = async (storeId) => {
  if (USE_SIMULATOR) {
    return [];
  }

  const encodedData = await dataLayer.getStoreData(storeId);
  if (encodedData) {
    const decodedData = decodeDataLayerResponse(encodedData);
    return decodedData.reduce((obj, current) => {
      obj[current.key] = current.value;
      return obj;
    }, {});
  } else {
    return undefined;
  }
};

/**
 * Checks if the store data has been updated and triggers the appropriate callbacks.
 *
 * @param {string} storeId - The ID of the store to check.
 * @param {string} lastRootHash - The last known root hash for comparison.
 * @param {function} callback - Callback to invoke to process the store data.
 * @param {function} onFail - Callback to invoke if an operation fails.
 */
const getStoreIfUpdated = async (storeId, lastRootHash, callback, onFail) => {
  try {
    const rootResponse = await dataLayer.getRoot(storeId);

    if (rootResponse.confirmed && rootResponse.hash !== lastRootHash) {
      const curriedCallback = (data) => callback(rootResponse.hash, data);

      await getStoreData(
        storeId,
        curriedCallback,
        onFail,
        rootResponse.hash,
        0,
      );
    }
  } catch (error) {
    logger.error(
      `getStoreIfUpdated() failed to get updated store data. Error: ${error.message}`,
    );
    onFail(error.message);
  }
};

export const getLocalStoreData = async (storeId) => {
  const encodedData = await dataLayer.getStoreData(storeId);

  if (!encodedData) {
    return false;
  }

  return decodeDataLayerResponse(encodedData);
};

export const waitForAllTransactionsToConfirm = async () => {
  if (USE_SIMULATOR) {
    return true;
  }

  return dataLayer.waitForAllTransactionsToConfirm();
};

export default {
  subscribeToStoreOnDataLayer,
  getSubscribedStoreData,
  getRootHistory,
  getRootDiff,
  getStoreData,
  getLocalStoreData,
  getStoreIfUpdated,
  POLLING_INTERVAL,
  getCurrentStoreData,
  unsubscribeFromDataLayerStore,
  unsubscribeFromDataLayerStoreWithRetry,
  waitForAllTransactionsToConfirm,
};
