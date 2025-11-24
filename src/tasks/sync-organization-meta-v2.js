import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { OrganizationsV2 } from '../models/v2/index.js';
import { getConfig } from '../utils/config-loader.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { logger } from '../config/logger.js';

const CONFIG = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

const task = new Task('sync-organization-meta-v2', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    if (!CONFIG.USE_SIMULATOR) {
      await OrganizationsV2.syncOrganizationMeta();
    }
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  { id: 'sync-organization-meta-v2', preventOverrun: true },
);

export default job;

