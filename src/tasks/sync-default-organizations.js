import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { getDefaultOrganizationList } from '../utils/data-loaders.js';
import { Meta, Organization, Governance } from '../models/index.js';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader.js';
import _ from 'lodash';

const CONFIG = getConfig();

const task = new Task('sync-default-organizations', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.APP.USE_SIMULATOR) {
      // Check if governance data exists, and if not, trigger a governance sync
      // This ensures that once the wallet syncs, governance data will be synced
      // within the retry interval of this task (5 minutes) instead of waiting
      // for the governance sync task (24 hours)
      const governanceData = await Governance.findOne({
        where: { metaKey: 'orgList' },
        raw: true,
      });

      if (!governanceData && CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID) {
        const myOrganization = await Organization.getHomeOrg();
        if (
          _.get(myOrganization, 'orgUid', '') !==
          CONFIG.GOVERNANCE.GOVERNANCE_BODY_ID
        ) {
          logger.info(
            '[v1]: Governance data not found, triggering governance sync before checking default organizations',
          );
          try {
            await Governance.sync();
            logger.info('[v1]: Governance sync completed successfully');
          } catch (syncError) {
            logger.warn(
              `[v1]: Governance sync failed, will retry on next run: ${syncError.message}`,
            );
            // Don't throw here - let the task continue and retry governance sync on next run
            // This allows the task to proceed if governance sync fails but data exists
          }
        }
      }

      const defaultOrgRecords = await getDefaultOrganizationList();
      const userDeletedOrgs = await Meta.getUserDeletedOrgUids();

      for (const { orgUid } of defaultOrgRecords) {
        if (userDeletedOrgs?.includes(orgUid)) {
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
        `Retrying in ${CONFIG?.APP?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300} seconds`,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.APP?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  { id: 'sync-default-organizations', preventOverrun: true },
);

export default job;
