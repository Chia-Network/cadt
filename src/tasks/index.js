import { ToadScheduler } from 'toad-scheduler';
import { logger, loggerV2 } from '../config/logger.js';

import syncDefaultOrganizations from './sync-default-organizations.js';
import syncPickLists from './sync-picklists.js';
import syncRegistries from './sync-registries.js';
import syncOrganizationMeta from './sync-organization-meta.js';
import syncGovernanceBody from './sync-governance-body.js';
import mirrorCheck from './mirror-check.js';
import resetAuditTable from './reset-audit-table.js';
import validateOrganizationTableAndSubscriptions from './validate-organization-table-and-subscriptions.js';
import cleanUpFailedOrg from './clean-up-failed-org.js';
import coinManagement, { runCoinManagement } from './coin-management.js';

// V2 background tasks
import syncGovernanceBodyV2 from './sync-governance-body-v2.js';
import syncDefaultOrganizationsV2 from './sync-default-organizations-v2.js';
import syncOrganizationMetaV2 from './sync-organization-meta-v2.js';
import syncRegistriesV2 from './sync-registries-v2.js';
import mirrorCheckV2 from './mirror-check-v2.js';
import validateOrganizationTableAndSubscriptionsV2 from './validate-organization-table-and-subscriptions-v2.js';
import syncPicklistsV2 from './sync-picklists-v2.js';
import cleanUpFailedOrgV2 from './clean-up-failed-org-v2.js';

const scheduler = new ToadScheduler();

const jobRegistry = {};

const addJobToScheduler = (job) => {
  jobRegistry[job.id] = job;
  scheduler.addSimpleIntervalJob(job);
};

const start = async (enableV1 = true, enableV2 = true) => {
  // Add coin management task (runs regardless of V1/V2 as it manages shared wallet)
  // Only add it once, and only if at least one version is enabled
  if (enableV1 || enableV2) {
    // Run coin management FIRST and wait for completion before starting other tasks
    // This ensures coins are split before any tasks that might need them (like mirror creation)
    logger.info('[COIN_MANAGEMENT] Running initial coin management before starting other tasks...');
    try {
      await runCoinManagement();
      logger.info('[COIN_MANAGEMENT] Initial coin management completed');
    } catch (error) {
      // Log but don't fail startup - coin management will retry on next interval
      logger.warn(`[COIN_MANAGEMENT] Initial coin management failed: ${error.message}. Will retry on next interval.`);
    }

    // Now register the scheduled job for future runs
    if (scheduler.existsById(coinManagement.id)) {
      scheduler.stopById(coinManagement.id);
      scheduler.removeById(coinManagement.id);
    }
    jobRegistry[coinManagement.id] = coinManagement;
    scheduler.addSimpleIntervalJob(coinManagement);
    logger.info('[COIN_MANAGEMENT] Coin management task registered for periodic runs');
  }

  // add default jobs (V1) if enabled
  if (enableV1) {
    const defaultJobs = [
      syncGovernanceBody,
      syncDefaultOrganizations,
      syncPickLists,
      syncRegistries,
      syncOrganizationMeta,
      mirrorCheck,
      resetAuditTable,
      validateOrganizationTableAndSubscriptions,
      cleanUpFailedOrg,
    ];
    defaultJobs.forEach((defaultJob) => {
      // Remove job if it already exists (for testing)
      if (scheduler.existsById(defaultJob.id)) {
        scheduler.stopById(defaultJob.id);
        scheduler.removeById(defaultJob.id);
      }
      jobRegistry[defaultJob.id] = defaultJob;
      scheduler.addSimpleIntervalJob(defaultJob);
    });
  } else {
    logger.info('[v1]: V1 is disabled in config - skipping V1 scheduler tasks');
  }

  // add V2 background tasks if enabled
  if (enableV2) {
    const v2Jobs = [
      syncGovernanceBodyV2,
      syncDefaultOrganizationsV2,
      syncOrganizationMetaV2,
      syncRegistriesV2,
      mirrorCheckV2,
      validateOrganizationTableAndSubscriptionsV2,
      syncPicklistsV2,
      cleanUpFailedOrgV2,
    ];
    v2Jobs.forEach((v2Job) => {
      // Remove job if it already exists (for testing)
      if (scheduler.existsById(v2Job.id)) {
        scheduler.stopById(v2Job.id);
        scheduler.removeById(v2Job.id);
      }
      jobRegistry[v2Job.id] = v2Job;
      scheduler.addSimpleIntervalJob(v2Job);
    });
  } else {
    loggerV2.info('[v2]: V2 is disabled in config - skipping V2 scheduler tasks');
  }
};

const getJobStatus = () => {
  return Object.keys(jobRegistry).reduce((status, key) => {
    status[key] = jobRegistry[key].getStatus();
    return status;
  }, {});
};

const stopAll = () => {
  // Get all job IDs before clearing registry
  const jobIds = Object.keys(jobRegistry);

  // Stop and remove all jobs from scheduler
  jobIds.forEach((jobId) => {
    try {
      if (scheduler.existsById(jobId)) {
        scheduler.stopById(jobId);
        scheduler.removeById(jobId);
      }
    } catch (error) {
      // Job might not exist, ignore
    }
  });

  // Clear job registry
  jobIds.forEach((key) => {
    delete jobRegistry[key];
  });
};

export default { start, addJobToScheduler, jobRegistry, getJobStatus, stopAll };
