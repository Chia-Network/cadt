import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { pullPickListValues } from '../utils/data-loaders.js';
import { logger } from '../config/logger.cjs';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { getConfig } from '../utils/config-loader.js';

const CONFIG = getConfig().APP;

const task = new Task('sync-picklist', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    pullPickListValues();
  } catch (error) {
    logger.error(
      `Retrying in ${CONFIG?.TASKS?.PICKLIST_SYNC_TASK_INTERVAL || 30} seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.PICKLIST_SYNC_TASK_INTERVAL || 30,
    runImmediately: true,
  },
  task,
  { id: 'sync-picklist', preventOverrun: true },
);

export default job;
