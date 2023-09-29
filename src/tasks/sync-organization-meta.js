import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import { CONFIG } from '../user-config';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../logger.js';

import dotenv from 'dotenv';
dotenv.config();

logger.task('CADT:task:sync-organizations');

const task = new Task('sync-organization-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    logger.task('Syncing subscribed organizations');
    if (!CONFIG().CADT.USE_SIMULATOR) {
      Organization.syncOrganizationMeta();
    }
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG().CADT?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG().CADT?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  'sync-organization-meta',
);

export default job;
