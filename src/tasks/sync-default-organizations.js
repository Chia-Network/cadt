import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../logger.js';
import { CONFIG } from '../user-config';

import dotenv from 'dotenv';
dotenv.config();

const task = new Task('sync-default-organizations', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();
    if (!CONFIG().CADT.USE_SIMULATOR) {
      Organization.subscribeToDefaultOrganizations();
    }
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG().CADT.TASK?.GOVERNANCE_SYNC_TASK_INTERVAL || 30
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG().CADT.TASK?.GOVERNANCE_SYNC_TASK_INTERVAL || 30,
    runImmediately: true,
  },
  task,
  { id: 'sync-default-organizations', preventOverrun: true },
);

export default job;
