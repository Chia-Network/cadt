import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { OrganizationsV2 } from '../models/v2/index.js';
import { getConfig } from '../utils/config-loader.js';
import { logger } from '../config/logger.js';

const CONFIG = getConfig().APP;

const task = new Task('clean-up-failed-org-v2', async () => {
  logger.debug('[v2]: cleaning up any records from failed V2 organization creations');
  try {
    if (!CONFIG.USE_SIMULATOR) {
      await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
    }
  } catch (error) {
    logger.error(
      `failed to clean up failed V2 organization creation records. Error: ${error.message}`,
    );
  }
});

/**
 * cleans up an interrupted home organization creation. if we have a PENDING org_uid on start up that means the app
 * was stopped or crashed during home org creation. these records need to be cleaned up.
 * @type {SimpleIntervalJob}
 */
const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.CLEAN_UP_FAILED_ORG_TASK_INTERVAL || 604800, // Default: 7 days in seconds
    runImmediately: true,
  },
  task,
  { id: 'clean-up-failed-org-v2', preventOverrun: true },
);

export default job;

