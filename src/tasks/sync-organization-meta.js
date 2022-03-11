import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import dotenv from 'dotenv';
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:organizations');

const log = Debug('climate-warehouse:task:organizations');

const task = new Task('sync-organization-meta', () => {
  log('Syncing subscribed organizations');
  if (process.env.USE_SIMULATOR === 'false') {
    Organization.syncOrganizationMeta();
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-organization-meta',
);

export default job;
