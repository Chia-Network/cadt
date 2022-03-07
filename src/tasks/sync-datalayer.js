import { SimpleIntervalJob, Task } from 'toad-scheduler';
import datalayer from '../datalayer';
import dotenv from 'dotenv';
import cliSpinner from 'cli-spinner';
const Spinner = cliSpinner.Spinner;
dotenv.config();

const spinner = new Spinner('Waiting for Updates %s');
spinner.setSpinnerString('|/-\\');
spinner.setSpinnerDelay(500);

const task = new Task('sync-datalayer', () => {
  spinner.stop();
  spinner.start();
  datalayer.startDataLayerUpdatePolling();
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
