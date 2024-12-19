import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { getDefaultOrganizationList } from '../utils/data-loaders.js';
import { Meta, Organization } from '../models/index.js';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader.js';

const CONFIG = getConfig().APP;

const task = new Task('sync-default-organizations', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.USE_SIMULATOR) {
      const defaultOrgRecords = await getDefaultOrganizationList();
      if (!Array.isArray(defaultOrgRecords)) {
        throw new Error(
          'ERROR: Default Organization List Not found, This instance may be missing data from default orgs',
        );
      }

      const userDeletedOrgs = await Meta.getUserDeletedOrgUids();

      for (const { orgUid } of defaultOrgRecords) {
        if (userDeletedOrgs.includes(orgUid)) {
          logger.verbose(
            `default organization ${orgUid} has been explicitly removed from this instance. not adding or checking that it exists`,
          );
          continue;
        }

        const organization = await Organization.findOne({
          where: { orgUid },
          raw: true,
        });

        if (!organization) {
          logger.debug(
            `default organization ${orgUid} was NOT found in the organizations table. running the import process to correct`,
          );
          await Organization.importOrganization(orgUid);
        } else {
          const orgReduced = organization;
          delete orgReduced.icon;
          delete orgReduced.metadata;
          logger.debug(
            `sync default orgs task found the following organization data associated with default org (icon and meta removed for compactness) ${orgUid}:\n${JSON.stringify(orgReduced)}`,
          );
        }
      }
    }
  } catch (error) {
    logger.error(
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
  { id: 'sync-default-organizations', preventOverrun: true },
);

export default job;
