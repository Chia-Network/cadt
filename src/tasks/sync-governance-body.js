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

const CONFIG = getConfig();

import dotenv from 'dotenv';
dotenv.config();

const task = new Task('sync-governance-meta', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    logger.info('[v1]: Syncing governance data');
    if (CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID) {
      logger.info(
        `Governance Config Found ${CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID}`,
      );

      const myOrganization = await Organization.getHomeOrg();

      if (
        _.get(myOrganization, 'orgUid', '') !==
        CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID
      ) {
        // Await V1 governance sync to ensure it completes before continuing
        await Governance.sync();

        // Also sync V2 governance if V2 organizations exist
        const { OrganizationsV2 } = await import('../models/v2/index.js');
        const v2HomeOrg = await OrganizationsV2.findOne({
          where: { is_home: true },
          raw: true,
        });
        if (v2HomeOrg) {
          const { GovernanceV2 } = await import('../models/v2/index.js');
          await GovernanceV2.sync();
        }
      }
    }
  } catch (error) {
    logger.error(
      `Cant download Goverance data, Retrying in ${
        CONFIG?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 86400
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    // DEFAULT 1 day
    seconds: CONFIG?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 86400,
    runImmediately: true,
  },
  task,
  { id: 'sync-governance-meta', preventOverrun: true },
);

export default job;
