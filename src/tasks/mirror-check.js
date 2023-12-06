import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.cjs';
import { getConfig } from '../utils/config-loader';
import { getMirrorUrl } from '../utils/datalayer-utils';
import dotenv from 'dotenv';

const CONFIG = getConfig().APP;
dotenv.config();

// This task checks if there are any mirrors that have not been properly mirrored and then mirrors them if not

const task = new Task('mirror-check', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    // Default AUTO_MIRROR_EXTERNAL_STORES to true if it is null or undefined
    const shouldMirror = CONFIG?.AUTO_MIRROR_EXTERNAL_STORES ?? true;

    if (!CONFIG.USE_SIMULATOR && shouldMirror) {
      runMirrorCheck();
    }
  } catch (error) {
    logger.error(
      `Retrying in ${CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 300} seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  { id: 'mirror-check', preventOverrun: true },
);

const runMirrorCheck = async () => {
  const homeOrg = Organization.getHomeOrg();

  if (homeOrg) {
    const organizations = Organization.getOrgsMap();
    const orgs = Object.keys(organizations);
    for (const org of orgs) {
      const orgData = organizations[org];
      const mirrorUrl = await getMirrorUrl();

      // There is logic within the addMirror function to check if the mirror already exists
      await Organization.addMirror(orgData.orgUid, mirrorUrl);
      await Organization.addMirror(orgData.registryId, mirrorUrl);
    }
  }
};

export default job;
