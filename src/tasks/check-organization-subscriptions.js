import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { getConfig } from '../utils/config-loader.js';
import { Meta, Organization } from '../models/index.js';
import {
  getOwnedStores,
  getSubscriptions,
  subscribeToStoreOnDataLayer,
} from '../datalayer/persistance.js';
import { logger } from '../config/logger.js';
import datalayer from '../datalayer/index.js';

const CONFIG = getConfig();

const task = new Task('check-organization-subscriptions', async () => {
  const hasMigratedToNewSyncMethod = await Meta.findOne({
    where: { metaKey: 'migratedToNewSync' },
  });

  const hasMigratedToGenerationIndexSync = await Meta.findOne({
    where: { metaKey: 'migratedToIndexBasedSync' },
  });

  if (!hasMigratedToGenerationIndexSync || !hasMigratedToNewSyncMethod) {
    logger.debug(
      'skipping check organization subscriptions task: waiting for migration tasks to complete',
    );
    return;
  }

  logger.debug('running check organization subscriptions task');

  try {
    const organizations = await Organization.findAll();
    const subscribedStores = await getSubscriptions();
    const ownedStores = await getOwnedStores();

    if (!subscribedStores?.success) {
      throw new Error('failed to get subscriptions from datalayer');
    }

    for (const organization of organizations) {
      const { orgUid, registryId, isHome, name } = organization;
      const orgStoreData = await datalayer.getCurrentStoreData(orgUid);

      // note here the registryId is the datamodel version store
      const dataModelStoreId = orgStoreData.find(
        (record) => record?.key === 'registryId',
      )?.value;

      if (!dataModelStoreId) {
        throw new Error(
          `failed to retrieve datamodel version store id for organization ${name} (orgUid ${orgUid})`,
        );
      }

      logger.debug(
        `validating that datalayer is subscribed to org store ${orgUid}, datamodel version store ${dataModelStoreId}, and registry store ${registryId} belonging to ${name}`,
      );

      if (isHome) {
        const homeOrgStoreOwned = ownedStores.storeIds.includes(orgUid);
        const dataModelVersionStoreOwned =
          ownedStores.storeIds.includes(dataModelStoreId);
        const homeRegistryStoreOwned =
          ownedStores.storeIds.includes(registryId);

        if (!homeOrgStoreOwned) {
          throw new Error(
            `your wallet does not own your home organization store ${orgUid}. this is a serious issue that CADT cannot resolve`,
          );
        }

        if (!dataModelVersionStoreOwned) {
          throw new Error(
            `your wallet does not own your home datamodel version store ${dataModelStoreId}. this is a serious issue that CADT cannot resolve`,
          );
        }

        if (!homeRegistryStoreOwned) {
          throw new Error(
            `your wallet does not own your home registry store ${registryId}. this is a serious issue that CADT cannot resolve`,
          );
        }
      }

      const subscribedToOrgStore = subscribedStores.storeIds.includes(orgUid);
      const subscribedToDataModelVersionStore =
        subscribedStores.storeIds.includes(dataModelStoreId);
      const subscribedToRegistryStore =
        subscribedStores.storeIds.includes(registryId);

      if (!subscribedToOrgStore) {
        logger.info(
          `datalayer is not subscribed to orgUid store ${orgUid}, subscribing ...`,
        );

        const result = await subscribeToStoreOnDataLayer(orgUid, true);
        if (result) {
          logger.info(`subscribed to store ${orgUid}`);
        } else {
          throw new Error(`failed to subscribe to store ${orgUid}`);
        }

        // wait 5 secs to give RPC a break
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      if (!subscribedToDataModelVersionStore) {
        logger.info(
          `datalayer is not subscribed to datamodel version store ${dataModelStoreId}, subscribing ...`,
        );

        const result = await subscribeToStoreOnDataLayer(
          dataModelStoreId,
          true,
        );
        if (result) {
          logger.info(`subscribed to store ${dataModelStoreId}`);
        } else {
          throw new Error(`failed to subscribe to store ${dataModelStoreId}`);
        }

        // wait 5 secs to give RPC a break
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      if (!subscribedToRegistryStore) {
        logger.info(
          `datalayer is not subscribed to registryId store ${registryId}, subscribing ...`,
        );

        const result = await subscribeToStoreOnDataLayer(registryId, true);
        if (result) {
          logger.info(`subscribed to store ${registryId}`);
        } else {
          throw new Error(`failed to subscribe to store ${registryId}`);
        }

        // wait 5 secs to give RPC a break
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    logger.error(
      `check-organization-subscriptions task encountered an error: ${error.message}`,
    );
  }
});

/**
 * checks that datalayer is subscribed to all organization stores contained in the organization table, and resubscribes
 * to any that are missing. This does not resubscribe based on governance data, only the data in the organization table.
 * @type {SimpleIntervalJob}
 */
const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.CHECK_ORG_TABLE_SUBSCRIPTIONS_TASK_INTERVAL || 1800,
    runImmediately: true,
  },
  task,
  { id: 'check-oranization-subscriptions', preventOverrun: true },
);

export default job;
