import { SimpleIntervalJob, Task } from 'toad-scheduler';
import datalayer from '../datalayer';
import dotenv from 'dotenv';
import cliSpinner from 'cli-spinner';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../logger.js';

const Spinner = cliSpinner.Spinner;
dotenv.config();
import { CONFIG } from '../user-config';

logger.task('CADT:task:sync-datalayer');

const spinner = new Spinner('Waiting for Updates %s');
spinner.setSpinnerString('|/-\\');
spinner.setSpinnerDelay(500);

const task = new Task('sync-datalayer', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    spinner.stop();
    spinner.start();
    datalayer.startDataLayerUpdatePolling();
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG().CADT.TASKS?.DATAMODEL_SYNC_TASK_INTERVAL || 60
      } seconds`,
      error,
    );
  }
});

let seconds = 5;
if (process.env.NODE_ENV !== 'test') {
  seconds = CONFIG().CADT.TASKS?.DATAMODEL_SYNC_TASK_INTERVAL || 60;
}

const job = new SimpleIntervalJob(
  { seconds, runImmediately: true },
  task,
  'sync-datalayer',
);

export default job;
