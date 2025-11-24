import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { pullPickListValuesV2 } from '../utils/v2-data-loaders.js';
import { logger } from '../config/logger.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { getConfig } from '../utils/config-loader.js';

const CONFIG = getConfig().APP;

const task = new Task('sync-picklist-v2', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    if (!CONFIG.USE_SIMULATOR) {
      await pullPickListValuesV2();
    }
  } catch (error) {
    logger.error(
      `Retrying in ${CONFIG?.TASKS?.PICKLIST_SYNC_TASK_INTERVAL || 600} seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.PICKLIST_SYNC_TASK_INTERVAL || 600,
    runImmediately: true,
  },
  task,
  { id: 'sync-picklist-v2', preventOverrun: true },
);

export default job;

