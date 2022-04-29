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

logger.info('climate-warehouse:task:sync-datalayer');

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
    logger.error('Retrying in 60 seconds', error);
  }
});

let seconds = 5;
if (process.env.NODE_ENV !== 'test') {
  seconds = 60;
}

const job = new SimpleIntervalJob(
  { seconds, runImmediately: true },
  task,
  'sync-datalayer',
);

export default job;
