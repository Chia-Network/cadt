import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import dotenv from 'dotenv';
dotenv.config();

const task = new Task('sync-organizations', () => {
  console.log('Subscribing to default organizations');
  if (process.env.USE_SIMULATOR === 'false') {
    Organization.subscribeToDefaultOrganizations();
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-organizations',
);

export default job;
