import { ToadScheduler } from 'toad-scheduler';

import syncDataLayer from './sync-datalayer';
import syncDefaultOrganizations from './sync-default-organizations';
import syncAudit from './sync-audit-table';
import syncOrganizationMeta from './sync-organization-meta';
import syncGovernanceBody from './sync-governance-body';

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
    syncDataLayer,
    syncDefaultOrganizations,
    syncAudit,
    syncOrganizationMeta,
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
