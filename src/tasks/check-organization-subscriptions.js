import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { getConfig } from '../utils/config-loader.js';
import { Meta, Organization } from '../models/index.js';
import { getOwnedStores } from '../datalayer/persistance.js';
import { logger } from '../config/logger.js';

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
    const ownedStores = await getOwnedStores();

    for (const organization of organizations) {
      try {
        const { orgUid, registryId, isHome, name } = organization;

        logger.debug(
          `running the organization subscription process on organization ${name} (orgUid ${orgUid})`,
        );

        const datalayerOrganizationStoreIds =
          await Organization.subscribeToOrganization(orgUid);

        if (isHome) {
          const homeOrgStoreOwned = ownedStores.storeIds.includes(orgUid);
          const dataModelVersionStoreOwned = ownedStores.storeIds.includes(
            datalayerOrganizationStoreIds.dataModelVersionStoreId,
          );
          const homeRegistryStoreOwned =
            ownedStores.storeIds.includes(registryId);

          if (!homeOrgStoreOwned) {
            throw new Error(
              `your wallet does not own your home organization store ${orgUid}. this is a serious issue that CADT cannot resolve`,
            );
          }

          if (!dataModelVersionStoreOwned) {
            throw new Error(
              `your wallet does not own your home datamodel version store ${datalayerOrganizationStoreIds.dataModelVersionStoreId}. this is a serious issue that CADT cannot resolve`,
            );
          }

          if (!homeRegistryStoreOwned) {
            throw new Error(
              `your wallet does not own your home registry store ${registryId}. this is a serious issue that CADT cannot resolve`,
            );
          }
        }
      } catch (error) {
        logger.error(
          `check-organization-subscriptions task error while processing org ${organization?.orgUid}. Error: ${error.message}`,
        );
      }
    }
  } catch (error) {
    logger.error(
      `check-organization-subscriptions task encountered an error and could not complete: ${error.message}`,
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
