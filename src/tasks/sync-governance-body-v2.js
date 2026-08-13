import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { getConfig, getConfigV2 } from '../utils/config-loader.js';
import { loggerV2 } from '../config/logger.js';
import { GovernanceV2 } from '../models/v2/index.js';
import { OrganizationsV2 } from '../models/v2/index.js';
import { markGovernanceReady } from '../utils/governance-readiness.js';

const CONFIG = getConfig().APP;
const CONFIG_V2 = getConfigV2();

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const task = new Task('sync-governance-meta-v2', async () => {
  try {
    // Skip governance sync in simulator mode - no datalayer to sync from
    // Fallback picklist will be used instead
    if (CONFIG.USE_SIMULATOR) {
      loggerV2.debug('[v2]: Simulator mode - skipping governance sync (using fallback picklist)');
      return;
    }

    // Readiness is a freshness timestamp, not a sync-in-progress flag; do not
    // clear it here. See utils/governance-readiness.js.
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    loggerV2.debug('[v2]: Syncing V2 governance data');
    const { GOVERNANCE_BODY_ID } = CONFIG_V2.GOVERNANCE;

    if (GOVERNANCE_BODY_ID) {
      loggerV2.debug(
        `[v2]: Governance Config Found ${GOVERNANCE_BODY_ID}`,
      );

      // Check if this node is the governance body itself
      const v2HomeOrg = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      // Only sync if we're not the governance body ourselves
      if (!v2HomeOrg || v2HomeOrg.org_uid !== GOVERNANCE_BODY_ID) {
        await GovernanceV2.sync();
      } else {
        markGovernanceReady('v2');
        loggerV2.debug(
          '[v2]: This node is the governance body, skipping governance sync',
        );
      }
    } else {
      loggerV2.debug('[v2]: No GOVERNANCE_BODY_ID configured, skipping governance sync');
    }
  } catch (error) {
    loggerV2.error(
      `[v2]: Cannot download Governance data, Retrying in ${
        CONFIG?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 120
      } seconds. Error: ${error.message}`,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 120,
    runImmediately: true,
  },
  task,
  { id: 'sync-governance-meta-v2', preventOverrun: true },
);

export default job;

