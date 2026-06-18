import _ from 'lodash';
import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Governance } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.js';
import { Organization } from '../models';
import {
  markGovernanceNotReady,
  markGovernanceReady,
} from '../utils/governance-readiness.js';

const CONFIG = getConfig();

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const task = new Task('sync-governance-meta', async () => {
  try {
    // Skip governance sync in simulator mode - no datalayer to sync from
    // Fallback picklist will be used instead
    if (CONFIG.APP.USE_SIMULATOR) {
      logger.debug('[v1]: Simulator mode - skipping governance sync (using fallback picklist)');
      return;
    }

    markGovernanceNotReady('v1');
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    logger.debug('[v1]: Syncing governance data');
    if (CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID) {
      logger.debug(
        `Governance Config Found ${CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID}`,
      );

      const myOrganization = await Organization.getHomeOrg();

      if (
        _.get(myOrganization, 'orgUid', '') !==
        CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID
      ) {
        await Governance.sync();
      } else {
        markGovernanceReady('v1');
      }
    }
  } catch (error) {
    logger.error(
      `Cant download Goverance data, Retrying in ${
        CONFIG?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 120
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 120,
    runImmediately: true,
  },
  task,
  { id: 'sync-governance-meta', preventOverrun: true },
);

export default job;
