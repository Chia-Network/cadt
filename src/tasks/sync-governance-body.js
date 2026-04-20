import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Governance, Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.js';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export const GOVERNANCE_SYNC_JOB_ID = 'sync-governance-meta';

const getSteadyStateIntervalSeconds = () =>
  getConfig()?.APP?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 1800;

const shouldSyncGovernance = async () => {
  const config = getConfig();
  const governanceBodyId = config?.GOVERNANCE?.GOVERNANCE_BODY_ID;

  logger.info('[v1]: Syncing governance data');
  if (!governanceBodyId) {
    logger.debug('[v1]: No GOVERNANCE_BODY_ID configured, skipping governance sync');
    return false;
  }

  logger.info(`Governance Config Found ${governanceBodyId}`);
  const myOrganization = await Organization.getHomeOrg();
  if (myOrganization?.orgUid === governanceBodyId) {
    logger.debug('[v1]: This node is the governance body, skipping governance sync');
    return false;
  }

  return true;
};

const createGovernanceTask = ({
  intervalSeconds = getSteadyStateIntervalSeconds(),
  isBootstrap = false,
  onBootstrapComplete = undefined,
} = {}) =>
  new Task(GOVERNANCE_SYNC_JOB_ID, async () => {
    try {
      const config = getConfig();

      // Skip governance sync in simulator mode - no datalayer to sync from
      // Fallback picklist will be used instead
      if (config.APP.USE_SIMULATOR) {
        logger.debug('[v1]: Simulator mode - skipping governance sync (using fallback picklist)');
        return;
      }

      await assertDataLayerAvailable();
      await assertWalletIsSynced();

      if (await shouldSyncGovernance()) {
        await Governance.sync();
      }

      if (isBootstrap && (await Governance.hasLocalGovernanceData())) {
        onBootstrapComplete?.();
      }
    } catch (error) {
      logger.error(
        `Cant download Goverance data, Retrying in ${intervalSeconds} seconds`,
        error,
      );
    }
  });

export const createSyncGovernanceBodyJob = ({
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
    { id: GOVERNANCE_SYNC_JOB_ID, preventOverrun: true },
  );

export default createSyncGovernanceBodyJob();
