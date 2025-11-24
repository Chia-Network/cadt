import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { MetaV2, OrganizationsV2 } from '../models/v2/index.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader.js';
import dotenv from 'dotenv';

const CONFIG = getConfig().APP;

dotenv.config();

const task = new Task('validate-organization-table-v2', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.USE_SIMULATOR) {
      const organizations = await OrganizationsV2.findAll({ raw: true });
      logger.info(
        'validating V2 organization table record store ids against datalayer store ids',
      );

      for (const organization of organizations) {
        if (organization.org_uid !== 'PENDING') {
          // this is in the loop to prevent this task from trying to operate on an organization that was deleted while it was running
          const deletedOrganizations = await MetaV2.getUserDeletedOrgUids();
          if (deletedOrganizations?.includes(organization.org_uid)) {
            continue;
          }

          if (organization.subscribed) {
            logger.verbose(
              `running the organization reconciliation process for ${organization.name} (org_uid ${organization.org_uid})`,
            );

            try {
              await OrganizationsV2.reconcileOrganization(organization);
            } catch (error) {
              logger.error(
                `failed reconcile organization records and subscriptions for organization ${organization.org_uid}. Error: ${error.message}. `,
              );
            }
          } else {
            logger.info(
              `organization ${organization.org_uid} is marked as unsubscribed. ensuring all organization stores are unsubscribed`,
            );
            await OrganizationsV2.unsubscribeFromOrganizationStores(
              organization,
            );
          }
        }
      }
    }
  } catch (error) {
    logger.error(
      `failed to validate default organization records and subscriptions for V2. Error ${error.message}. ` +
        `Retrying in ${CONFIG?.TASKS?.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL || 900} seconds`,
    );
  }
});

/**
 * checks that store ids from the organization records match the singleton structure in data layer
 * and ensures that all organizations in the subscription table are subscribed to the required stores.
 *
 * if the `subscribed` column of the organization record is false, then the task will ensure datalayer is
 * not subscribed to the organizations stores.
 * @type {SimpleIntervalJob}
 */
const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL || 900,
    runImmediately: true,
  },
  task,
  { id: 'validate-organization-table-v2', preventOverrun: true },
);

export default job;

