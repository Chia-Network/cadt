import { ToadScheduler } from 'toad-scheduler';

import syncDataLayer from './sync-datalayer';
import syncOrganizations from './sync-organizations';
import syncPickLists from './sync-picklists';

const scheduler = new ToadScheduler();

const jobRegistry = {};

const addJobToScheduler = (job) => {
  jobRegistry[job.id] = job;
  scheduler.addSimpleIntervalJob(job);
};

const start = () => {
  // add default jobs
  const defaultJobs = [syncDataLayer, syncOrganizations, syncPickLists];
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
