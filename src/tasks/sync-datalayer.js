import { SimpleIntervalJob, Task } from 'toad-scheduler';
import datalayer from '../datalayer';
import dotenv from 'dotenv';
import cliSpinner from 'cli-spinner';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
const Spinner = cliSpinner.Spinner;
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:sync-datalayer');

const log = Debug('climate-warehouse:task:sync-datalayer');

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
    log(`${error.message} retrying in 60 seconds`);
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
