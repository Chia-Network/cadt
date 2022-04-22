import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import { getConfig } from '../utils/config-loader';
const { USE_SIMULATOR } = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:organizations');

const log = Debug('climate-warehouse:task:organizations');

const task = new Task('sync-organization-meta', () => {
  log('Syncing subscribed organizations');
  if (!USE_SIMULATOR) {
    Organization.syncOrganizationMeta();
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-organization-meta',
);

export default job;
