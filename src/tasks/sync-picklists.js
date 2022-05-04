import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { pullPickListValues } from '../utils/data-loaders';
import { logger } from '../config/logger.cjs';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';

logger.info('climate-warehouse:task:sync-picklists');

const retryInSeconds = 30;

const task = new Task('sync-picklist', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    pullPickListValues();
  } catch (error) {
    logger.error(`Retrying in ${retryInSeconds} seconds`, error);
  }
});

const job = new SimpleIntervalJob(
  { seconds: retryInSeconds, runImmediately: true },
  task,
  'sync-picklist',
);

export default job;
