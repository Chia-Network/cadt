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

const { GOVERANCE_BODY_ID } = getConfig().GOVERNANCE;

import dotenv from 'dotenv';
dotenv.config();

logger.info('climate-warehouse:task:sync-governance');

const task = new Task('sync-governance-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    logger.info('Syncing governance data');
    if (GOVERANCE_BODY_ID) {
      logger.info(`Governance Config Found ${GOVERANCE_BODY_ID}`);

      const myOrganization = await Organization.getHomeOrg();

      if (_.get(myOrganization, 'orgUid', '') !== GOVERANCE_BODY_ID) {
        Governance.sync();
      }
    }
  } catch (error) {
    logger.error('Cant download Goverance data, Retrying in 24 hours', error);
  }
});

const job = new SimpleIntervalJob(
  { days: 1, runImmediately: true },
  task,
  'sync-governance-meta',
);

export default job;
