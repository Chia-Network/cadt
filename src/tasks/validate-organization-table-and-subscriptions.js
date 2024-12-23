import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
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
        logger.debug(
          `running the organization reconciliation process for ${organization.name} (orgUid ${organization.orgUid})`,
        );
        await Organization.reconcileOrganization(organization);
      }
    }
  } catch (error) {
    logger.error(
      `failed to validate default organization records and subscriptions. Error ${error.message}. ` +
        `Retrying in ${CONFIG?.TASKS?.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL || 30} seconds`,
    );
  }
});

/**
 * checks that store ids from the organization records match the singleton structure in data layer
 * and ensures that all organizations in the subscription table are subscribed to the required stores
 * @type {SimpleIntervalJob}
 */
const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL || 30,
    runImmediately: true,
  },
  task,
  { id: 'validate-organization-table', preventOverrun: true },
);

export default job;
