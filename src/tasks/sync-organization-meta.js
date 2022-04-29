import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import { getConfig } from '../utils/config-loader';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.cjs';

const { USE_SIMULATOR } = getConfig().APP;

import dotenv from 'dotenv';
dotenv.config();

logger.info('climate-warehouse:task:sync-organizations');

const task = new Task('sync-organization-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    logger.info('Syncing subscribed organizations');
    if (!USE_SIMULATOR) {
      Organization.syncOrganizationMeta();
    }
  } catch (error) {
    logger.error('Retrying in 24 hours', error);
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-organization-meta',
);

export default job;
