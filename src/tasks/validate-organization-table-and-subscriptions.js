import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Meta, Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader';
const CONFIG = getConfig().APP;

import dotenv from 'dotenv';

dotenv.config();

const task = new Task('validate-organization-table', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.USE_SIMULATOR) {
      const organizations = await Organization.findAll({ raw: true });
      logger.info(
        'validating organization table record store ids against datalayer store ids',
      );

      for (const organization of organizations) {
        // this is in the loop to prevent this task from trying to operate on an organization that was deleted while it was running
        const deletedOrganizations = await Meta.getUserDeletedOrgUids();
        if (deletedOrganizations?.includes(organization.orgUid)) {
          continue;
        }

        if (organization.subscribed) {
          logger.verbose(
            `running the organization reconciliation process for ${organization.name} (orgUid ${organization.orgUid})`,
          );

          try {
            await Organization.reconcileOrganization(organization);
          } catch (error) {
            logger.error(
              `failed reconcile organization records and subscriptions for organization ${organization.orgUid}. Error: ${error.message}. `,
            );
          }
        } else {
          logger.info(
            `organization ${organization.orgUid} is marked as unsubscribed. ensuring all organization stores are unsubscribed`,
          );
          await Organization.unsubscribeFromOrganizationStores(organization);
        }
      }
    }
  } catch (error) {
    logger.error(
      `failed to validate default organization records and subscriptions. Error ${error.message}. ` +
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
  { id: 'validate-organization-table', preventOverrun: true },
);

export default job;
