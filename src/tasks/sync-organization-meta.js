import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import { getConfig } from '../utils/config-loader';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
const { USE_SIMULATOR } = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

import Debug from 'debug';
Debug.enable('climate-warehouse:task:sync-organizations');

const log = Debug('climate-warehouse:task:sync-organizations');
const task = new Task('sync-organization-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    log('Syncing subscribed organizations');
    if (process.env.USE_SIMULATOR === 'false') {
      Organization.syncOrganizationMeta();
    }
  } catch (error) {
    log(`${error.message} retrying in 24 hours`);
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-organization-meta',
);

export default job;
