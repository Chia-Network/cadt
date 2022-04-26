import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getConfig } from '../utils/config-loader';
const { USE_SIMULATOR } = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:default-organizations');

const log = Debug('climate-warehouse:task:default-organizations');

const task = new Task('sync-default-organizations', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    if (!USE_SIMULATOR) {
      Organization.subscribeToDefaultOrganizations();
    }
  } catch (error) {
    log(`${error.message} retrying in 30 seconds`);
  }
});

const job = new SimpleIntervalJob(
  { seconds: 30, runImmediately: true },
  task,
  'sync-default-organizations',
);

export default job;
