import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { getDefaultOrganizationListV2 } from '../utils/v2-data-loaders.js';
import { MetaV2, OrganizationsV2 } from '../models/v2/index.js';
import { loggerV2 } from '../config/logger.js';
import { getConfig, getConfigV2 } from '../utils/config-loader.js';
import {
  buildOrgListAllowSet,
  removeOrgsNotInOrgList,
} from '../utils/orglist-subscription-reconcile.js';

const CONFIG = getConfig().APP;

let lastHeartbeat = 0;

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
      const onlyCadtSubscriptions = CONFIG.ONLY_CADT_SUBSCRIPTIONS === true;

      const pending = [];
      const imported = [];
      const resubscribePending = [];

      for (const { orgUid } of defaultOrgList) {
        if (
          !onlyCadtSubscriptions &&
          userDeletedOrgs?.includes(orgUid)
        ) {
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
          pending.push(orgUid);
        } else {
          imported.push(orgUid);
          if (onlyCadtSubscriptions && !organization.subscribed) {
            resubscribePending.push(orgUid);
          }
        }
      }

      // Emit rate-limited heartbeat while orgs are still waiting
      if (pending.length > 0) {
        const now = Date.now();
        if (now - lastHeartbeat >= 60_000) {
          lastHeartbeat = now;
          const sample = pending.slice(0, 5).map((id) => `${id.slice(0, 8)}...`);
          const extra = pending.length > 5 ? `, ... +${pending.length - 5} more` : '';
          loggerV2.info(
            `[v2]: CADT is waiting for DataLayer to sync default organization stores: ${imported.length} imported, ${pending.length} waiting [${sample.join(', ')}${extra}]. Next check within 30s.`,
          );
        }
      }

      // Fan out imports in parallel
      const results = await Promise.allSettled(
        pending.map(async (orgUid) => {
          loggerV2.debug(
            `[v2]: default organization ${orgUid} was NOT found in the organizations table. running the import process to correct`,
          );
          await OrganizationsV2.importOrganization(orgUid);
          const importedOrg = await OrganizationsV2.findOne({
            where: { org_uid: orgUid },
            raw: true,
          });
          if (importedOrg) {
            loggerV2.info(`[v2]: Successfully imported default organization ${orgUid}`);
          } else {
            loggerV2.debug(
              `[v2]: Import of default organization ${orgUid} deferred - store may still be syncing. Will retry on next task run.`,
            );
          }
        }),
      );

      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          loggerV2.warn(
            `[v2]: Failed to import default organization ${pending[i]}: ${result.reason?.message || result.reason}. Will retry on next task run.`,
          );
        }
      });

      const resubscribeResults = await Promise.allSettled(
        resubscribePending.map(async (orgUid) => {
          await OrganizationsV2.subscribeToOrganization(orgUid);
          loggerV2.info(
            `[v2]: ONLY_CADT_SUBSCRIPTIONS: re-subscribed organization ${orgUid}`,
          );
        }),
      );
      resubscribeResults.forEach((result, i) => {
        if (result.status === 'rejected') {
          loggerV2.warn(
            `[v2]: ONLY_CADT_SUBSCRIPTIONS: failed to re-subscribe organization ${resubscribePending[i]}: ${result.reason?.message || result.reason}. Will retry on next task run.`,
          );
        }
      });

      if (onlyCadtSubscriptions) {
        const { GOVERNANCE_BODY_ID } = getConfigV2().GOVERNANCE;
        const allowSet = buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID);
        await removeOrgsNotInOrgList({
          defaultOrgList,
          allowSet,
          organizationModel: OrganizationsV2,
          fieldNames: {
            orgUid: 'org_uid',
            isHome: 'is_home',
            subscribed: 'subscribed',
          },
          unsubscribeFromOrganizationStores:
            OrganizationsV2.unsubscribeFromOrganizationStores.bind(OrganizationsV2),
          // Background removal of an off-orglist org is not a user deletion, so
          // it must not be recorded in the user-deleted suppression list.
          deleteAllOrganizationData: (orgUid) =>
            OrganizationsV2.deleteAllOrganizationData(orgUid, {
              recordUserDeleted: false,
            }),
          logger: loggerV2,
          apiVersionLabel: 'v2',
        });
      }
    }
  } catch (error) {
    loggerV2.error(
      `[v2]: failed to validate default organization records and subscriptions. Error ${error.message}. ` +
        `Retrying in ${CONFIG?.TASKS?.DEFAULT_ORGANIZATIONS_SYNC_TASK_INTERVAL || 30} seconds`,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.DEFAULT_ORGANIZATIONS_SYNC_TASK_INTERVAL || 30,
    runImmediately: true,
  },
  task,
  { id: 'sync-default-organizations-v2', preventOverrun: true },
);

export default job;

