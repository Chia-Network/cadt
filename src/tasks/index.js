import { ToadScheduler } from 'toad-scheduler';

import syncDefaultOrganizations from './sync-default-organizations';
import syncPickLists from './sync-picklists';
import syncRegistries from './sync-registries';
import syncOrganizationMeta from './sync-organization-meta';
import syncGovernanceBody from './sync-governance-body';
import mirrorCheck from './mirror-check';
import resetAuditTable from './reset-audit-table';
import validateOrganizationTableAndSubscriptions from './validate-organization-table-and-subscriptions';
import cleanUpFailedOrg from './clean-up-failed-org';

const scheduler = new ToadScheduler();

const jobRegistry = {};

const addJobToScheduler = (job) => {
  jobRegistry[job.id] = job;
  scheduler.addSimpleIntervalJob(job);
};

const start = () => {
  // add default jobs
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
    jobRegistry[defaultJob.id] = defaultJob;
    scheduler.addSimpleIntervalJob(defaultJob);
  });
};

const getJobStatus = () => {
  return Object.keys(jobRegistry).reduce((status, key) => {
    status[key] = jobRegistry[key].getStatus();
    return status;
  }, {});
};

export default { start, addJobToScheduler, jobRegistry, getJobStatus };
