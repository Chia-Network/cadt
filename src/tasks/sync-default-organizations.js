import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import dotenv from 'dotenv';
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:organizations');

const log = Debug('climate-warehouse:task:organizations');

const task = new Task('sync-default-organizations', () => {
  log('Subscribing to default organizations');
  if (process.env.USE_SIMULATOR === 'false') {
    Organization.subscribeToDefaultOrganizations();
  }
});

const job = new SimpleIntervalJob(
  { seconds: 30, runImmediately: true },
  task,
  'sync-default-organizations',
);

export default job;
