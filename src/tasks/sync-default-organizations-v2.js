import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getDefaultOrganizationListV2 } from '../utils/v2-data-loaders.js';
import { MetaV2, OrganizationsV2, GovernanceV2 } from '../models/v2/index.js';
import { loggerV2 } from '../config/logger.js';
import { getConfig, getConfigV2 } from '../utils/config-loader.js';
import _ from 'lodash';

const CONFIG = getConfig().APP;
const CONFIG_V2 = getConfigV2();

const task = new Task('sync-default-organizations-v2', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.USE_SIMULATOR) {
      // Check if governance data exists, and if not, trigger a governance sync
      // This ensures that once the wallet syncs, governance data will be synced
      // within the retry interval of this task (5 minutes) instead of waiting
      // for the governance sync task (24 hours)
      const governanceData = await GovernanceV2.findOne({
        where: { meta_key: 'orgList' },
        raw: true,
      });

      if (!governanceData && CONFIG_V2.GOVERNANCE.GOVERNANCE_BODY_ID) {
        const v2HomeOrg = await OrganizationsV2.findOne({
          where: { is_home: true },
          raw: true,
        });
        if (!v2HomeOrg || v2HomeOrg.org_uid !== CONFIG_V2.GOVERNANCE.GOVERNANCE_BODY_ID) {
          loggerV2.info(
            '[v2]: Governance data not found, triggering governance sync before checking default organizations',
          );
          try {
            await GovernanceV2.sync();
            loggerV2.info('[v2]: Governance sync completed successfully');
          } catch (syncError) {
            loggerV2.warn(
              `[v2]: Governance sync failed, will retry on next run: ${syncError.message}`,
            );
            // Don't throw here - let the task continue and retry governance sync on next run
            // This allows the task to proceed if governance sync fails but data exists
          }
        }
      }

      const defaultOrgList = await getDefaultOrganizationListV2();
      const userDeletedOrgs = await MetaV2.getUserDeletedOrgUids();

      for (const { orgUid } of defaultOrgList) {
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
            `[v2]: default organization ${orgUid} was NOT found in the organizations table. running the import process to correct`,
          );
          try {
            await OrganizationsV2.importOrganization(orgUid);
            loggerV2.info(`[v2]: Successfully imported default organization ${orgUid}`);
          } catch (importError) {
            // Log error but continue to next org - this org will be retried on next task run
            // This prevents one slow/failed import from blocking all other orgs
            loggerV2.warn(
              `[v2]: Failed to import default organization ${orgUid}: ${importError.message}. Will retry on next task run.`,
            );
          }
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
      `[v2]: failed to validate default organization records and subscriptions. Error ${error.message}. ` +
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

