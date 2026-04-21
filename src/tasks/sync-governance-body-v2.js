import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { getConfig, getConfigV2 } from '../utils/config-loader.js';
import { loggerV2 } from '../config/logger.js';
import { GovernanceV2 } from '../models/v2/index.js';
import { OrganizationsV2 } from '../models/v2/index.js';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export const GOVERNANCE_SYNC_V2_JOB_ID = 'sync-governance-meta-v2';

const getSteadyStateIntervalSeconds = () =>
  getConfig()?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 1800;

const shouldSyncGovernance = async () => {
  const governanceBodyId = getConfigV2()?.GOVERNANCE?.GOVERNANCE_BODY_ID;

  loggerV2.info('[v2]: Syncing V2 governance data');
  if (!governanceBodyId) {
    loggerV2.debug('[v2]: No GOVERNANCE_BODY_ID configured, skipping governance sync');
    return false;
  }

  loggerV2.info(`[v2]: Governance Config Found ${governanceBodyId}`);
  const v2HomeOrg = await OrganizationsV2.findOne({
    where: { is_home: true },
    raw: true,
  });

  if (v2HomeOrg?.org_uid === governanceBodyId) {
    loggerV2.debug('[v2]: This node is the governance body, skipping governance sync');
    return false;
  }

  return true;
};

const createGovernanceTask = ({
  intervalSeconds = getSteadyStateIntervalSeconds(),
  isBootstrap = false,
  onBootstrapComplete = undefined,
} = {}) =>
  new Task(GOVERNANCE_SYNC_V2_JOB_ID, async () => {
    try {
      const config = getConfig().APP;

      // Skip governance sync in simulator mode - no datalayer to sync from
      // Fallback picklist will be used instead
      if (config.USE_SIMULATOR) {
        loggerV2.debug('[v2]: Simulator mode - skipping governance sync (using fallback picklist)');
        return;
      }

      await assertDataLayerAvailable();
      await assertWalletIsSynced();

      if (await shouldSyncGovernance()) {
        await GovernanceV2.sync();
      }

      if (isBootstrap && (await GovernanceV2.hasLocalGovernanceData())) {
        onBootstrapComplete?.();
      }
    } catch (error) {
      loggerV2.error(
        `[v2]: Cannot download Governance data, Retrying in ${intervalSeconds} seconds. Error: ${error.message}`,
      );
    }
  });

export const createSyncGovernanceBodyV2Job = ({
  intervalSeconds = getSteadyStateIntervalSeconds(),
  isBootstrap = false,
  onBootstrapComplete = undefined,
} = {}) =>
  new SimpleIntervalJob(
    {
      seconds: intervalSeconds,
      runImmediately: true,
    },
    createGovernanceTask({
      intervalSeconds,
      isBootstrap,
      onBootstrapComplete,
    }),
    { id: GOVERNANCE_SYNC_V2_JOB_ID, preventOverrun: true },
  );


