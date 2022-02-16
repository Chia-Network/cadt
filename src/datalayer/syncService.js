import _ from 'lodash';

import logUpdate from 'log-update';

import { decodeHex, decodeDataLayerResponse } from '../utils/datalayer-utils';
import { Organization, Staging, ModelKeys } from '../models';

import * as dataLayer from './persistance';
import * as simulator from './simulator';

export const POLLING_INTERVAL = 5000;
const frames = ['-', '\\', '|', '/'];

console.log('Start Datalayer Update Polling');
export const startDataLayerUpdatePolling = async () => {
  const storeIdsToUpdate = await dataLayerWasUpdated();
  if (storeIdsToUpdate.length) {
    await Promise.all(
      storeIdsToUpdate.map(async (storeId) => {
        logUpdate(
          `Updates found syncing storeId: ${storeId} ${
            frames[Math.floor(Math.random() * 3)]
          }`,
        );
        await syncDataLayerStoreToClimateWarehouse(storeId);
      }),
    );
  } else {
    logUpdate(`Polling For Updates ${frames[Math.floor(Math.random() * 3)]}`);
  }

  // after all the updates are complete, check again in a bit
  setTimeout(() => startDataLayerUpdatePolling(), POLLING_INTERVAL);
};

export const syncDataLayerStoreToClimateWarehouse = async (storeId) => {
  let storeData;

  if (process.env.USE_SIMULATOR === 'true') {
    storeData = await simulator.getStoreData(storeId);
  } else {
    storeData = await dataLayer.getStoreData(storeId);
  }

  const organizationToTrucate = await Organization.findOne({
    attributes: ['orgUid'],
    where: { registryId: storeId },
    raw: true,
  });

  try {
    if (_.get(organizationToTrucate, 'orgUid')) {
      const truncateOrganizationPromises = Object.keys(ModelKeys).map((key) =>
        ModelKeys[key].destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
      );

      await Promise.all(truncateOrganizationPromises);

      await Promise.all(
        storeData.keys_values.map(async (kv) => {
          const key = decodeHex(kv.key.replace(`${storeId}_`, ''));
          const modelKey = key.split('|')[0];
          const value = JSON.parse(decodeHex(kv.value));

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

export const dataLayerWasUpdated = async () => {
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
  if (process.env.USE_SIMULATOR === 'true') {
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

  const updatedStoreIds = await Promise.all(
    updatedStores.map(async (rootHash) => {
      const storeId = rootHash.id.replace('0x', '');

      // update the organization with the new hash
      await Organization.update(
        { registryHash: rootHash.hash },
        { where: { registryId: storeId } },
      );

      return storeId;
    }),
  );

  return updatedStoreIds;
};

export const subscribeToStoreOnDataLayer = async (storeId, ip, port) => {
  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.subscribeToStoreOnDataLayer(storeId, ip, port);
  } else {
    return dataLayer.subscribeToStoreOnDataLayer(storeId, ip, port);
  }
};

export const getSubscribedStoreData = async (
  storeId,
  ip,
  port,
  alreadySubscribed = false,
  retry = 0,
) => {
  console.log('Subscribing to', storeId, ip, port);
  if (retry > 10) {
    throw new Error('Max retrys exceeded, Can not subscribe to organization');
  }

  if (!alreadySubscribed) {
    const response = await subscribeToStoreOnDataLayer(storeId, ip, port);
    if (!response.success) {
      console.log(`Retrying...`, retry + 1);
      console.log('...');
      await new Promise((resolve) => setTimeout(() => resolve(), 30000));
      return getSubscribedStoreData(storeId, ip, port, false, retry + 1);
    }
  }

  if (process.env.USE_SIMULATOR !== 'true') {
    const storeExistAndIsConfirmed = await dataLayer.getRoot(storeId, true);
    if (!storeExistAndIsConfirmed) {
      console.log(`Retrying...`, retry + 1);
      console.log('...');
      await new Promise((resolve) => setTimeout(() => resolve(), 30000));
      return getSubscribedStoreData(storeId, ip, port, true, retry + 1);
    }
  }

  let encodedData;
  if (process.env.USE_SIMULATOR === 'true') {
    encodedData = await simulator.getStoreData(storeId);
  } else {
    encodedData = await dataLayer.getStoreData(storeId);
  }

  if (!encodedData) {
    console.log(`Retrying...`, retry + 1);
    console.log('...');
    await new Promise((resolve) => setTimeout(() => resolve(), 30000));
    return getSubscribedStoreData(storeId, ip, port, true, retry + 1);
  }

  const decodedData = decodeDataLayerResponse(encodedData);

  return decodedData.reduce((obj, current) => {
    obj[current.key] = current.value;
    return obj;
  }, {});
};
