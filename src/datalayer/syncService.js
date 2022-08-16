import _ from 'lodash';

import { decodeHex, decodeDataLayerResponse } from '../utils/datalayer-utils';
import { Organization, Staging, ModelKeys } from '../models';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.cjs';

import * as dataLayer from './persistance';
import * as simulator from './simulator';

const { USE_SIMULATOR } = getConfig().APP;

const POLLING_INTERVAL = 5000;
const frames = ['-', '\\', '|', '/'];

logger.debug('Start Datalayer Update Polling');
const startDataLayerUpdatePolling = async () => {
  const updateStoreInfo = await dataLayerWasUpdated();
  if (updateStoreInfo.length) {
    await Promise.all(
      updateStoreInfo.map(async (store) => {
        logger.debug(
          `Updates found syncing storeId: ${store.storeId} ${
            frames[Math.floor(Math.random() * 3)]
          }`,
        );
        await syncDataLayerStoreToClimateWarehouse(
          store.storeId,
          store.rootHash,
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

  await Organization.update(
    { registryHash: rootHash },
    { where: { registryId: storeId } },
  );

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

const getSubscribedStoreData = async (
  storeId,
  alreadySubscribed = false,
  retry = 0,
) => {
  if (retry >= 60) {
    throw new Error(
      `Max retrys exceeded while trying to subscribe to ${storeId}, Can not subscribe to organization`,
    );
  }

  const timeoutInterval = 30000;

  if (!alreadySubscribed) {
    const response = await subscribeToStoreOnDataLayer(storeId);
    if (!response || !response.success) {
      if (!response) {
        logger.debug(
          `Response from subscribe RPC came back undefined, is your datalayer running?`,
        );
      }
      logger.debug(
        `Retrying subscribe to ${storeId}, subscribe failed`,
        retry + 1,
      );
      logger.debug('...');
      await new Promise((resolve) =>
        setTimeout(() => resolve(), timeoutInterval),
      );
      return getSubscribedStoreData(storeId, false, retry + 1);
    }
  }

  if (!USE_SIMULATOR) {
    const storeExistAndIsConfirmed = await dataLayer.getRoot(storeId, true);
    if (!storeExistAndIsConfirmed) {
      logger.debug(
        `Retrying subscribe to ${storeId}, store not yet confirmed.`,
        retry + 1,
      );
      logger.debug('...');
      await new Promise((resolve) =>
        setTimeout(() => resolve(), timeoutInterval),
      );
      return getSubscribedStoreData(storeId, true, retry + 1);
    } else {
      logger.debug(
        `Store Exists and is confirmed, proceededing to get data ${storeId}`,
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
    logger.debug(
      `Retrying subscribe to ${storeId}, No data detected in store.`,
      retry + 1,
    );
    logger.debug('...');
    await new Promise((resolve) =>
      setTimeout(() => resolve(), timeoutInterval),
    );
    return getSubscribedStoreData(storeId, true, retry + 1);
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
  }
};

const getRootDiff = (storeId, root1, root2) => {
  if (!USE_SIMULATOR) {
    return dataLayer.getRootDiff(storeId, root1, root2);
  }
};

const getStoreData = async (storeId, callback, onFail, retry = 0) => {
  if (retry <= 10) {
    const encodedData = await dataLayer.getStoreData(storeId);
    if (_.isEmpty(encodedData?.keys_values)) {
      await new Promise((resolve) => setTimeout(() => resolve(), 60000));
      return getStoreData(storeId, callback, onFail, retry + 1);
    } else {
      callback(decodeDataLayerResponse(encodedData));
    }
  } else {
    onFail();
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

const getStoreIfUpdated = async (
  storeId,
  lastRootHash,
  onUpdate,
  callback,
  onFail,
) => {
  const rootResponse = await dataLayer.getRoot(storeId);
  if (rootResponse.confirmed && rootResponse.hash !== lastRootHash) {
    logger.debug(`Updating orgUid ${storeId} with hash ${rootResponse.hash}`);
    onUpdate(rootResponse.hash);
    await getStoreData(storeId, callback, onFail);
  }
};

export const getLocalStoreData = async (storeId) => {
  const encodedData = await dataLayer.getStoreData(storeId);

  if (!encodedData) {
    return false;
  }

  return decodeDataLayerResponse(encodedData);
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
};
