import _ from 'lodash';

import logUpdate from 'log-update';

import { decodeHex } from '../utils/datalayer-utils';
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

  console.log(rootResponse);

  if (!rootResponse.success) {
    return [];
  }

  const updatedStores = rootResponse.root_hashes.filter((rootHash) => {
    const org = organizations.find(
      (org) => org.registryId == rootHash.id.replace('0x', ''),
    );

    if (org) {
      console.log(rootHash);
      // store has been updated if its confirmed and the hash has changed
      return rootHash.status === 2 && org.registryHash != rootHash.hash;
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
