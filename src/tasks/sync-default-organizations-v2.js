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
      // Governance sync is owned by the scheduler
      // (src/tasks/sync-governance-body-v2.js). This task relies on whatever
      // governance data is already in the local DB; if none is present yet,
      // getDefaultOrganizationListV2() returns an empty list and we'll pick
      // up the orgs on the next run after the governance-sync task populates
      // them.
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
            // Verify the org was actually created (importOrganization may return early
            // if store is not synced yet, without throwing an error)
            const imported = await OrganizationsV2.findOne({
              where: { org_uid: orgUid },
              raw: true,
            });
            if (imported) {
              loggerV2.info(`[v2]: Successfully imported default organization ${orgUid}`);
            } else {
              loggerV2.debug(
                `[v2]: Import of default organization ${orgUid} deferred - store may still be syncing. Will retry on next task run.`,
              );
            }
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
        `Retrying in ${CONFIG?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300} seconds`,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.ORGANIZATION_META_SYNC_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  { id: 'sync-default-organizations-v2', preventOverrun: true },
);

export default job;

