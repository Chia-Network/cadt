import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Meta, Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../logger';
import { CONFIG } from '../user-config';
import { getMirrorUrl } from '../utils/datalayer-utils';
import dotenv from 'dotenv';

dotenv.config();
// This task checks if there are any mirrors that have not been properly mirrored and then mirrors them if not

const task = new Task('mirror-check', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    // Default AUTO_MIRROR_EXTERNAL_STORES to true if it is null or undefined
    const shouldMirror = CONFIG().CADT.AUTO_MIRROR_EXTERNAL_STORES ?? true;

    if (!CONFIG().CADT.USE_SIMULATOR && shouldMirror) {
      await runMirrorCheck();
    }
  } catch (error) {
    logger.error(
      `Retrying in ${
        CONFIG().CADT.TASKS.MIRROR_CHECK_TASK_INTERVAL || 300
      } seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG().CADT.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  { id: 'mirror-check', preventOverrun: true },
);

const runMirrorCheck = async () => {
  const mirrorUrl = await getMirrorUrl();

  if (!mirrorUrl) {
    logger.info(
      'DATALAYER_FILE_SERVER_URL not set, skipping mirror announcements',
    );
    return;
  }

  // get governance info if governance node
  const governanceOrgUidResult = await Meta.findOne({
    where: { metaKey: 'governanceBodyId' },
    attributes: ['metaValue'],
    raw: true,
  });
  const governanceRegistryIdResult = await Meta.findOne({
    where: { metaKey: 'mainGoveranceBodyId' },
    attributes: ['metaValue'],
    raw: true,
  });

  if (
    governanceOrgUidResult?.metaValue &&
    governanceRegistryIdResult?.metaValue
  ) {
    // add governance mirrors if instance is governance
    // There is logic within the addMirror function to check if the mirror already exists
    await Organization.addMirror(
      governanceOrgUidResult?.metaValue,
      mirrorUrl,
      true,
    );
    await Organization.addMirror(
      governanceRegistryIdResult?.metaValue,
      mirrorUrl,
      true,
    );
  }

  const organizations = await Organization.getOrgsMap();
  const orgs = Object.keys(organizations);
  for (const org of orgs) {
    if (org?.subscribed) {
      const orgData = organizations[org];
      await Organization.addMirror(orgData.orgUid, mirrorUrl, true);
      await Organization.addMirror(orgData.dataModelVersionStoreId, true);
      await Organization.addMirror(orgData.registryId, mirrorUrl, true);
    }
  }
};

export default job;
