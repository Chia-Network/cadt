import { ToadScheduler } from 'toad-scheduler';

import syncDefaultOrganizations from './sync-default-organizations';
import syncPickLists from './sync-picklists';
import syncRegistries from './sync-registries';
import syncOrganizationMeta from './sync-organization-meta';
import syncGovernanceBody from './sync-governance-body';
import mirrorCheck from './mirror-check';

const scheduler = new ToadScheduler();

const jobRegistry = {};

console.log('ZGB: In the scheduler logic now'); //zgb

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
