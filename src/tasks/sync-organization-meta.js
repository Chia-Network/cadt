import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import { getConfig } from '../utils/config-loader';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.cjs';

const CONFIG = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

logger.info('CADT:task:sync-organizations');

const task = new Task('sync-organization-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    logger.info('Syncing subscribed organizations');
    if (!CONFIG.USE_SIMULATOR) {
      Organization.syncOrganizationMeta();
    }
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG?.APP?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    // DEFAULT 1
    seconds: CONFIG?.APP?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  'sync-organization-meta',
);

export default job;
