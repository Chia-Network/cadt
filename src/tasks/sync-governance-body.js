import _ from 'lodash';
import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Governance } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.cjs';
import { Organization } from '../models';

const CONFIG = getConfig();

import dotenv from 'dotenv';
dotenv.config();

logger.info('CADT:task:sync-governance');

const task = new Task('sync-governance-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    logger.info('Syncing governance data');
    if (CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID) {
      logger.info(
        `Governance Config Found ${CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID}`,
      );

      const myOrganization = await Organization.getHomeOrg();

      if (
        _.get(myOrganization, 'orgUid', '') !==
        CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID
      ) {
        Governance.sync();
      }
    }
  } catch (error) {
    logger.error(
      `Cant download Goverance data, Retrying in ${
        CONFIG?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 300
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    // DEFAULT 1 day
    seconds: CONFIG?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  'sync-governance-meta',
);

export default job;
