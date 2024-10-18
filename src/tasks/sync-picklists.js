import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { pullPickListValues } from '../utils/data-loaders';
import { logger } from '../config/logger.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getConfig } from '../utils/config-loader';

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
