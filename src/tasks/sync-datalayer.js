import logUpdate from 'log-update';
import { SimpleIntervalJob, Task } from 'toad-scheduler';
import datalayer from '../datalayer';
const frames = ['-', '\\', '|', '/'];

const task = new Task('sync-datalayer', () => {
  logUpdate(`Polling For Updates ${frames[Math.floor(Math.random() * 3)]}`);

  datalayer.startDataLayerUpdatePolling();
});

const job = new SimpleIntervalJob(
  { seconds: 5, runImmediately: true },
  task,
  'sync-datalayer',
);

export default job;
