import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';

import dotenv from 'dotenv';
import { CONFIG } from '../user-config.js';
import { logger } from '../logger';

dotenv.config();

const task = new Task('clean-up failed-org', async () => {
  logger.debug('cleaning up any records from failed organization creations');
  try {
    if (!CONFIG().CADT.USE_SIMULATOR) {
      await Organization.destroy({ where: { orgUid: 'PENDING' } });
    }
  } catch (error) {
    logger.error(
      `failed to clean up failed organization creation records. Error: ${error.message}`,
    );
  }
});

/**
 * cleans up an interrupted home organization creation. if we have a PENDING orgUid on start up that means the app
 * was stopped or crashed during home org creation. these records need to be cleaned up.
 * @type {SimpleIntervalJob}
 */
const job = new SimpleIntervalJob(
  {
    days: 7, // basically only want this to run on startup. BAD EXAMPLE. DO NOT DO THIS. look at other tasks
    runImmediately: true,
  },
  task,
  { id: 'clean-up-failed-org', preventOverrun: true },
);

export default job;
