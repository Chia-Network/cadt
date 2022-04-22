import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import { getConfig } from '../utils/config-loader';
const { USE_SIMULATOR } = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:organizations');

const log = Debug('climate-warehouse:task:organizations');

const task = new Task('sync-default-organizations', () => {
  log('Subscribing to default organizations');
  if (!USE_SIMULATOR) {
    Organization.subscribeToDefaultOrganizations();
  }
});

const job = new SimpleIntervalJob(
  { seconds: 30, runImmediately: true },
  task,
  'sync-default-organizations',
);

export default job;
