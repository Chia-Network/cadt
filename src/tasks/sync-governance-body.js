import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Governance } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.cjs';

const { GOVERANCE_BODY_ID, GOVERNANCE_BODY_IP, GOVERNANCE_BODY_PORT } =
  getConfig().GOVERNANCE;

import dotenv from 'dotenv';
dotenv.config();

logger.info('climate-warehouse:task:sync-governance');

const task = new Task('sync-governance-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    logger.info('Syncing governance data');
    if (GOVERANCE_BODY_ID && GOVERNANCE_BODY_IP && GOVERNANCE_BODY_PORT) {
      Governance.sync();
    }
  } catch (error) {
    logger.error('Retrying in 24 hours', error);
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-governance-meta',
);

export default job;
