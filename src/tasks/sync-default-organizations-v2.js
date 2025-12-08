import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getDefaultOrganizationListV2 } from '../utils/v2-data-loaders.js';
import { MetaV2, OrganizationsV2 } from '../models/v2/index.js';
import { loggerV2 } from '../config/logger.js';
import { getConfig } from '../utils/config-loader.js';

const CONFIG = getConfig().APP;

const task = new Task('sync-default-organizations-v2', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.USE_SIMULATOR) {
      const defaultOrgList = await getDefaultOrganizationListV2();
      const userDeletedOrgs = await MetaV2.getUserDeletedOrgUids();

      for (const orgUid of defaultOrgList) {
        if (userDeletedOrgs?.includes(orgUid)) {
          loggerV2.verbose(
            `default organization ${orgUid} has been explicitly removed from this instance. not adding or checking that it exists`,
          );
          continue;
        }

        const organization = await OrganizationsV2.findOne({
          where: { org_uid: orgUid },
          raw: true,
        });

        if (!organization) {
          loggerV2.debug(
            `default organization ${orgUid} was NOT found in the organizations table. running the import process to correct`,
          );
          await OrganizationsV2.importOrganization(orgUid);
        } else {
          const orgReduced = { ...organization };
          delete orgReduced.icon;
          delete orgReduced.metadata;
          loggerV2.debug(
            `sync default orgs task found the following organization data associated with default org (icon and meta removed for compactness) ${orgUid}:\n${JSON.stringify(orgReduced)}`,
          );
        }
      }
    }
  } catch (error) {
    loggerV2.error(
      `failed to validate default organization records and subscriptions. Error ${error.message}. ` +
        `Retrying in ${CONFIG?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 300} seconds`,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.GOVERNANCE_SYNC_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  { id: 'sync-default-organizations-v2', preventOverrun: true },
);

export default job;

