import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models/index.js';
import { getConfig } from '../utils/config-loader.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { logger } from '../config/logger.cjs';

const CONFIG = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

const task = new Task('sync-organization-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
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
  { id: 'sync-organization-meta', preventOverrun: true },
);

export default job;
