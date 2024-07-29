import { ToadScheduler } from 'toad-scheduler';

import syncDefaultOrganizations from './sync-default-organizations.js';
import syncPickLists from './sync-picklists.js';
import syncRegistries from './sync-registries.js';
import syncOrganizationMeta from './sync-organization-meta.js';
import syncGovernanceBody from './sync-governance-body.js';
import mirrorCheck from './mirror-check.js';
import resetAuditTable from './reset-audit-table.js';

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
