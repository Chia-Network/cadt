import _ from 'lodash';

import { decodeHex, decodeDataLayerResponse } from '../utils/datalayer-utils';
import { Organization, Staging, ModelKeys } from '../models';
import { getConfig } from '../utils/config-loader';

import * as dataLayer from './persistance';
import * as simulator from './simulator';

import Debug from 'debug';
Debug.enable('climate-warehouse:datalayer:syncService');
const log = Debug('climate-warehouse:datalayer:syncService');

const { USE_SIMULATOR } = getConfig().APP;

const POLLING_INTERVAL = 5000;
const frames = ['-', '\\', '|', '/'];

log('Start Datalayer Update Polling');
const startDataLayerUpdatePolling = async () => {
  const updateStoreInfo = await dataLayerWasUpdated();
  if (updateStoreInfo.length) {
    await Promise.all(
      updateStoreInfo.map(async (store) => {
        log(
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
          const value = JSON.parse(decodeHex(kv.value));

          await ModelKeys[modelKey].create(value);

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
        }),
      );

      // clean up any staging records than involved delete commands,
      // since we cant track that they came in through the uuid,
      // we can infer this because diff.original is null instead of empty object.
      await Staging.cleanUpCommitedAndInvalidRecords();
    }
  } catch (error) {
    console.trace('ERROR DURING SYNC TRANSACTION', error, storeData);
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

const subscribeToStoreOnDataLayer = async (storeId, ip, port) => {
  if (USE_SIMULATOR) {
    return simulator.subscribeToStoreOnDataLayer(storeId, ip, port);
  } else {
    return dataLayer.subscribeToStoreOnDataLayer(storeId, ip, port);
  }
};

const getSubscribedStoreData = async (
  storeId,
  ip,
  port,
  alreadySubscribed = false,
  retry = 0,
) => {
  if (retry >= 60) {
    throw new Error('Max retrys exceeded, Can not subscribe to organization');
  }

  const timeoutInterval = 30000;

  if (!alreadySubscribed) {
    const response = await subscribeToStoreOnDataLayer(storeId, ip, port);
    if (!response.success) {
      log(`Retrying...`, retry + 1);
      log('...');
      await new Promise((resolve) =>
        setTimeout(() => resolve(), timeoutInterval),
      );
      return getSubscribedStoreData(storeId, ip, port, false, retry + 1);
    }
  }

  if (!USE_SIMULATOR) {
    const storeExistAndIsConfirmed = await dataLayer.getRoot(storeId, true);
    if (!storeExistAndIsConfirmed) {
      log(`Retrying...`, retry + 1);
      log('...');
      await new Promise((resolve) =>
        setTimeout(() => resolve(), timeoutInterval),
      );
      return getSubscribedStoreData(storeId, ip, port, true, retry + 1);
    }
  }

  let encodedData;
  if (USE_SIMULATOR) {
    encodedData = await simulator.getStoreData(storeId);
  } else {
    encodedData = await dataLayer.getStoreData(storeId);
  }

  log(encodedData?.keys_values);

  if (_.isEmpty(encodedData?.keys_values)) {
    log(`Retrying...`, retry + 1);
    log('...');
    await new Promise((resolve) =>
      setTimeout(() => resolve(), timeoutInterval),
    );
    return getSubscribedStoreData(storeId, ip, port, true, retry + 1);
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

const getStoreIfUpdated = async (
  storeId,
  lastRootHash,
  onUpdate,
  callback,
  onFail,
) => {
  const rootResponse = await dataLayer.getRoot(storeId);
  if (rootResponse.confirmed && rootResponse.hash !== lastRootHash) {
    log(`Updating orgUid ${storeId} with hash ${rootResponse.hash}`);
    onUpdate(rootResponse.hash);
    await getStoreData(storeId, callback, onFail);
  }
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
  getStoreIfUpdated,
  POLLING_INTERVAL,
};
