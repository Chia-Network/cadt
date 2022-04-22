import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { pullPickListValues } from '../utils/data-loaders';
import Debug from 'debug';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
Debug.enable('climate-warehouse:task:sync-picklists');

const log = Debug('climate-warehouse:task:sync-picklists');

const retryInSeconds = 30;

const task = new Task('sync-picklist', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    pullPickListValues();
  } catch (error) {
    log(`${error.message} retrying in ${retryInSeconds} seconds`);
  }
});

const job = new SimpleIntervalJob(
  { seconds: retryInSeconds, runImmediately: true },
  task,
  'sync-picklist',
);

export default job;
