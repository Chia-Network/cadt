import _ from 'lodash';

import { decodeHex, decodeDataLayerResponse } from '../utils/datalayer-utils';
import { Organization, Staging, ModelKeys, Simulator } from '../models';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.cjs';

import * as dataLayer from './persistance';
import * as simulator from './simulator';

const { USE_SIMULATOR } = getConfig().APP;

const POLLING_INTERVAL = 5000;
const frames = ['-', '\\', '|', '/'];

const startDataLayerUpdatePolling = async () => {
  logger.info('Start Datalayer Update Polling');
  const updateStoreInfo = await dataLayerWasUpdated();
  if (updateStoreInfo.length) {
    await Promise.all(
      updateStoreInfo.map(async (store) => {
        logger.info(
          `Updates found syncing storeId: ${store.storeId} ${
            frames[Math.floor(Math.random() * 3)]
          }`,
        );
        await syncDataLayerStoreToClimateWarehouse(
          store.storeId,
          store.rootHash,
        );

        console.log('UPDATE STORE', store.storeId, store.rootHash);
        await Organization.update(
          { registryHash: store.rootHash },
          { where: { registryId: store.storeId } },
        );
      }),
    );
  }
};

const syncDataLayerStoreToClimateWarehouse = async (storeId, rootHash) => {
  let storeData;

  if (USE_SIMULATOR) {
    storeData = await simulator.getStoreData(storeId, rootHash);
  } else {
    storeData = await dataLayer.getStoreData(storeId, rootHash);
  }

  if (!_.get(storeData, 'keys_values', []).length) {
    return;
  }

  const organizationToTruncate = await Organization.findOne({
    attributes: ['orgUid'],
    where: { registryId: storeId },
    raw: true,
  });

  try {
    if (_.get(organizationToTruncate, 'orgUid')) {
      const truncateOrganizationPromises = Object.keys(ModelKeys).map((key) =>
        ModelKeys[key].destroy({
          where: { orgUid: organizationToTruncate.orgUid },
        }),
      );

      await Promise.all(truncateOrganizationPromises);

      await Promise.all(
        storeData.keys_values.map(async (kv) => {
          const key = decodeHex(kv.key.replace(`${storeId}_`, ''));
          const modelKey = key.split('|')[0];
          let value;

          try {
            value = JSON.parse(decodeHex(kv.value));
          } catch (err) {
            console.trace(err);
            logger.error(`Cant parse json value: ${decodeHex(kv.value)}`);
          }

          if (ModelKeys[modelKey]) {
            await ModelKeys[modelKey].upsert(value);

            const stagingUuid =
              modelKey === 'unit'
                ? value.warehouseUnitId
                : modelKey === 'project'
                ? value.warehouseProjectId
                : undefined;

            if (stagingUuid) {
              await Staging.destroy({
                where: { uuid: stagingUuid },
              });
            }
          }
        }),
      );

      // clean up any staging records than involved delete commands,
      // since we cant track that they came in through the uuid,
      // we can infer this because diff.original is null instead of empty object.
      await Staging.cleanUpCommitedAndInvalidRecords();
    }
  } catch (error) {
    console.trace('ERROR DURING SYNC TRANSACTION', error);
  }
};

const dataLayerWasUpdated = async () => {
  const organizations = await Organization.findAll({
    attributes: ['registryId', 'registryHash'],
    where: { subscribed: true },
    raw: true,
  });

  // exit early if there are no subscribed organizations
  if (!organizations.length) {
    return [];
  }

  const subscribedOrgIds = organizations.map((org) => org.registryId);

  if (!subscribedOrgIds.length) {
    return [];
  }

  let rootResponse;
  if (USE_SIMULATOR) {
    rootResponse = await simulator.getRoots(subscribedOrgIds);
  } else {
    rootResponse = await dataLayer.getRoots(subscribedOrgIds);
  }

  if (!rootResponse.success) {
    return [];
  }

  const updatedStores = rootResponse.root_hashes.filter((rootHash) => {
    const org = organizations.find(
      (org) => org.registryId == rootHash.id.replace('0x', ''),
    );

    if (org) {
      // When a transfer is made, the climate warehouse is locked from making updates
      // while waiting for the transfer to either be completed or rejected.
      // This means that we know the transfer completed when the root hash changed
      // and we can remove it from the pending staging table.
      if (org.isHome == 1 && org.registryHash != rootHash.hash) {
        Staging.destroy({ where: { isTransfer: true } });
      }

      // store has been updated if its confirmed and the hash has changed
      return rootHash.confirmed && org.registryHash != rootHash.hash;
    }

    return false;
  });

  if (!updatedStores.length) {
    return [];
  }

  const updateStoreInfo = await Promise.all(
    updatedStores.map(async (rootHash) => {
      const storeId = rootHash.id.replace('0x', '');
      return {
        storeId,
        rootHash: rootHash.hash,
      };
    }),
  );

  return updateStoreInfo;
};

const unsubscribeFromDataLayerStore = async (storeId) => {
  if (!USE_SIMULATOR) {
    return dataLayer.unsubscribeFromDataLayerStore(storeId);
  }
};

const subscribeToStoreOnDataLayer = async (storeId) => {
  if (USE_SIMULATOR) {
    return simulator.subscribeToStoreOnDataLayer(storeId);
  } else {
    return dataLayer.subscribeToStoreOnDataLayer(storeId);
  }
};

const getSubscribedStoreData = async (storeId, retry = 0) => {
  if (retry >= 60) {
    throw new Error(
      `Max retrys exceeded while trying to subscribe to ${storeId}, Can not subscribe to organization`,
    );
  }

  const timeoutInterval = 30000;

  const subscriptions = await dataLayer.getSubscriptions(storeId);
  const alreadySubscribed = subscriptions.includes(storeId);

  if (!alreadySubscribed) {
    logger.info(`No Subscription Found for ${storeId}, Subscribing...`);
    const response = await subscribeToStoreOnDataLayer(storeId);

    if (!response || !response.success) {
      if (!response) {
        logger.info(
          `Response from subscribe RPC came back undefined, is your datalayer running?`,
        );
      }
      logger.info(
        `Retrying subscribe to ${storeId}, subscribe failed`,
        retry + 1,
      );
      logger.info('...');
      await new Promise((resolve) =>
        setTimeout(() => resolve(), timeoutInterval),
      );
      return getSubscribedStoreData(storeId, retry + 1);
    }
  }

  logger.info(`Subscription Found for ${storeId}.`);

  if (!USE_SIMULATOR) {
    logger.info(`Getting confirmation for ${storeId}.`);
    const storeExistAndIsConfirmed = await dataLayer.getRoot(storeId, true);
    logger.info(`Store found in DataLayer: ${storeId}.`);
    if (!storeExistAndIsConfirmed) {
      logger.info(
        `Retrying subscribe to ${storeId}, store not yet confirmed.`,
        retry + 1,
      );
      logger.info('...');
      await new Promise((resolve) =>
        setTimeout(() => resolve(), timeoutInterval),
      );
      return getSubscribedStoreData(storeId, retry + 1);
    } else {
      logger.debug(`Store is confirmed, proceeding to get data ${storeId}`);
    }
  }

  let encodedData;
  if (USE_SIMULATOR) {
    encodedData = await simulator.getStoreData(storeId);
  } else {
    encodedData = await dataLayer.getStoreData(storeId);
  }

  if (_.isEmpty(encodedData?.keys_values)) {
    logger.info(
      `Retrying subscribe to ${storeId}, No data detected in store.`,
      retry + 1,
    );
    logger.info('...');
    await new Promise((resolve) =>
      setTimeout(() => resolve(), timeoutInterval),
    );
    return getSubscribedStoreData(storeId, retry + 1);
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
  const MAX_RETRIES = 50;
  const RETRY_DELAY = 120000;

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
    return decodeDataLayerResponse(encodedData);
  } else {
    return [];
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
    logger.error(error.message);
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
  startDataLayerUpdatePolling,
  syncDataLayerStoreToClimateWarehouse,
  dataLayerWasUpdated,
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
  waitForAllTransactionsToConfirm,
};
