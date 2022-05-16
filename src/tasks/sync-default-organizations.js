import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.cjs';
import { getConfig } from '../utils/config-loader';
const { USE_SIMULATOR } = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

logger.info('climate-warehouse:task:sync-default-organizations');

const task = new Task('sync-default-organizations', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    if (!USE_SIMULATOR) {
      Organization.subscribeToDefaultOrganizations();
    }
  } catch (error) {
    logger.error('Retrying in 30 seconds', error);
  }
});

const job = new SimpleIntervalJob(
  { seconds: 30, runImmediately: true },
  task,
  'sync-default-organizations',
);

export default job;
