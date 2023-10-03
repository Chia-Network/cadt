import { SimpleIntervalJob, Task } from 'toad-scheduler';
import datalayer from '../datalayer';
import dotenv from 'dotenv';
import cliSpinner from 'cli-spinner';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.cjs';

const Spinner = cliSpinner.Spinner;
dotenv.config();
import { getConfig } from '../utils/config-loader';
const CONFIG = getConfig().APP;

logger.info('CADT:task:sync-datalayer');

const spinner = new Spinner('Waiting for Updates %s');
spinner.setSpinnerString('|/-\\');
spinner.setSpinnerDelay(500);

let taskIsRunning = false;

const task = new Task('sync-datalayer', async () => {
  try {
    if (!taskIsRunning) {
      taskIsRunning = true;
      logger.info('Syncing datalayer data');
      await assertDataLayerAvailable();
      await assertWalletIsSynced();

      spinner.stop();
      spinner.start();
      datalayer.startDataLayerUpdatePolling();
    }
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG?.TASKS?.DATAMODEL_SYNC_TASK_INTERVAL || 60
      } seconds`,
      error,
    );
  } finally {
    taskIsRunning = false;
  }
});

let seconds = 5;
if (process.env.NODE_ENV !== 'test') {
  seconds = CONFIG?.TASKS?.DATAMODEL_SYNC_TASK_INTERVAL || 60;
}

const job = new SimpleIntervalJob(
  { seconds, runImmediately: true },
  task,
  'sync-datalayer',
);

export default job;
