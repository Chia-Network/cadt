import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { MetaV2, OrganizationsV2 } from '../models/v2/index.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { loggerV2 } from '../config/logger.js';
import { getConfig, getConfigV2 } from '../utils/config-loader.js';
import { getDefaultOrganizationListV2 } from '../utils/v2-data-loaders.js';
import { buildOrgListAllowSet } from '../utils/orglist-subscription-reconcile.js';
import dotenv from 'dotenv';

const CONFIG = getConfig().APP;

dotenv.config({ quiet: true });

const task = new Task('validate-organization-table-v2', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.USE_SIMULATOR) {
      const onlyCadtSubscriptions = CONFIG.ONLY_CADT_SUBSCRIPTIONS === true;
      let orgListAllowSet = null;
      if (onlyCadtSubscriptions) {
        const defaultOrgList = await getDefaultOrganizationListV2();
        if (defaultOrgList.length > 0) {
          const { GOVERNANCE_BODY_ID } = getConfigV2().GOVERNANCE;
          orgListAllowSet = buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID);
        }
      }

      const organizations = await OrganizationsV2.findAll({ raw: true });
      loggerV2.info(
        'validating V2 organization table record store ids against datalayer store ids',
      );

      for (const organization of organizations) {
        if (organization.org_uid !== 'PENDING') {
          // this is in the loop to prevent this task from trying to operate on an organization that was deleted while it was running
          const deletedOrganizations = await MetaV2.getUserDeletedOrgUids();
          if (deletedOrganizations?.includes(organization.org_uid)) {
            continue;
          }

          if (organization.subscribed) {
            loggerV2.verbose(
              `running the organization reconciliation process for ${organization.name} (org_uid ${organization.org_uid})`,
            );

            try {
              // Background task — skip (not throw) when the org/singleton store
              // is unsynced or a subscribe call fails, so a transient datalayer
              // hiccup doesn't spam ERROR logs or block task cadence.
              await OrganizationsV2.reconcileOrganization(organization, {
                skipOnUnsynced: true,
              });
            } catch (error) {
              loggerV2.error(
                `failed reconcile organization records and subscriptions for organization ${organization.org_uid}. Error: ${error.message}. `,
              );
            }
          } else if (
            onlyCadtSubscriptions &&
            orgListAllowSet?.has(organization.org_uid)
          ) {
            loggerV2.verbose(
              `[v2]: ONLY_CADT_SUBSCRIPTIONS: skipping validate unsubscribe for orglist org ${organization.org_uid} (sync-default-organizations owns subscription)`,
            );
          } else {
            loggerV2.info(
              `organization ${organization.org_uid} is marked as unsubscribed. ensuring all organization stores are unsubscribed`,
            );
            await OrganizationsV2.unsubscribeFromOrganizationStores(
              organization,
            );
          }
        }
      }
    }
  } catch (error) {
    loggerV2.error(
      `failed to validate default organization records and subscriptions for V2. Error ${error.message}. ` +
        `Retrying in ${CONFIG?.TASKS?.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL || 900} seconds`,
    );
  }
});

/**
 * checks that store ids from the organization records match the singleton structure in data layer
 * and ensures that all organizations in the subscription table are subscribed to the required stores.
 *
 * if the `subscribed` column of the organization record is false, then the task will ensure datalayer is
 * not subscribed to the organizations stores.
 * @type {SimpleIntervalJob}
 */
const job = new SimpleIntervalJob(
  {
    seconds: CONFIG?.TASKS?.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL || 900,
    runImmediately: true,
  },
  task,
  { id: 'validate-organization-table-v2', preventOverrun: true },
);

export default job;

