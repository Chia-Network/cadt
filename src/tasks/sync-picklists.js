import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { pullPickListValues } from '../utils/data-loaders';
import { logger } from '../logger.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { CONFIG } from '../user-config';

const task = new Task('sync-picklist', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    pullPickListValues();
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG().TASKS?.PICKLIST_SYNC_TASK_INTERVAL || 30
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG().TASKS?.PICKLIST_SYNC_TASK_INTERVAL || 30,
    runImmediately: true,
  },
  task,
  'sync-picklist',
);

export default job;
