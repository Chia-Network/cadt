import { SimpleIntervalJob, Task } from 'toad-scheduler';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { getDefaultOrganizationList } from '../utils/data-loaders.js';
import { Meta, Organization } from '../models/index.js';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader.js';

const CONFIG = getConfig();

let lastHeartbeat = 0;

const task = new Task('sync-default-organizations', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.APP.USE_SIMULATOR) {
      // Governance sync is owned by the scheduler
      // (src/tasks/sync-governance-body.js). This task relies on whatever
      // governance data is already in the local DB; if none is present yet,
      // getDefaultOrganizationList() returns an empty list and we'll pick up
      // the orgs on the next run after the governance-sync task populates
      // them.
      const defaultOrgRecords = await getDefaultOrganizationList();
      const userDeletedOrgs = await Meta.getUserDeletedOrgUids();

      const pending = [];
      const imported = [];

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
          pending.push(orgUid);
        } else {
          imported.push(orgUid);
        }
      }

      // Emit rate-limited heartbeat while orgs are still waiting
      if (pending.length > 0) {
        const now = Date.now();
        if (now - lastHeartbeat >= 60_000) {
          lastHeartbeat = now;
          const sample = pending.slice(0, 5).map((id) => `${id.slice(0, 8)}...`);
          const extra = pending.length > 5 ? `, ... +${pending.length - 5} more` : '';
          logger.info(
            `[v1]: CADT is waiting for DataLayer to sync default organization stores: ${imported.length} imported, ${pending.length} waiting [${sample.join(', ')}${extra}]. Next check within 30s.`,
          );
        }
      }

      // Fan out imports in parallel
      const results = await Promise.allSettled(
        pending.map(async (orgUid) => {
          logger.debug(
            `default organization ${orgUid} was NOT found in the organizations table. running the import process to correct`,
          );
          await Organization.importOrganization(orgUid);
        }),
      );

      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          logger.warn(
            `[v1]: Failed to import default organization ${pending[i]}: ${result.reason?.message || result.reason}. Will retry on next task run.`,
          );
        }
      });
    }
  } catch (error) {
    logger.error(
      `failed to validate default organization records and subscriptions. Error ${error.message}. ` +
        `Retrying in ${CONFIG?.APP?.TASKS?.DEFAULT_ORGANIZATIONS_SYNC_TASK_INTERVAL || 30} seconds`,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.APP?.TASKS?.DEFAULT_ORGANIZATIONS_SYNC_TASK_INTERVAL || 30,
    runImmediately: true,
  },
  task,
  { id: 'sync-default-organizations', preventOverrun: true },
);

export default job;
