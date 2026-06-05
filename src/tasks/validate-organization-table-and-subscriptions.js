import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Meta, Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader';
import { getDefaultOrganizationList } from '../utils/data-loaders.js';
import { buildOrgListAllowSet } from '../utils/orglist-subscription-reconcile.js';

const CONFIG = getConfig();

import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const task = new Task('validate-organization-table', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    if (!CONFIG.APP.USE_SIMULATOR) {
      const onlyCadtSubscriptions = CONFIG.APP.ONLY_CADT_SUBSCRIPTIONS === true;
      let orgListAllowSet = null;
      if (onlyCadtSubscriptions) {
        const defaultOrgList = await getDefaultOrganizationList();
        if (defaultOrgList.length > 0) {
          const { GOVERNANCE_BODY_ID } = CONFIG.GOVERNANCE;
          orgListAllowSet = buildOrgListAllowSet(defaultOrgList, GOVERNANCE_BODY_ID);
        }
      }

      const organizations = await Organization.findAll({ raw: true });
      logger.info(
        'validating organization table record store ids against datalayer store ids',
      );

      for (const organization of organizations) {
        if (organization.orgUid !== 'PENDING') {
          // this is in the loop to prevent this task from trying to operate on an organization that was deleted while it was running
          const deletedOrganizations = await Meta.getUserDeletedOrgUids();
          if (deletedOrganizations?.includes(organization.orgUid)) {
            continue;
          }

          if (organization.subscribed) {
            logger.verbose(
              `running the organization reconciliation process for ${organization.name} (orgUid ${organization.orgUid})`,
            );

            try {
              // Background task — skip (not throw) when the org/singleton store
              // is unsynced or a subscribe call fails, so a transient datalayer
              // hiccup doesn't spam ERROR logs or block task cadence.
              await Organization.reconcileOrganization(organization, {
                skipOnUnsynced: true,
              });
            } catch (error) {
              logger.error(
                `failed reconcile organization records and subscriptions for organization ${organization.orgUid}. Error: ${error.message}. `,
              );
            }
          } else if (
            onlyCadtSubscriptions &&
            orgListAllowSet?.has(organization.orgUid)
          ) {
            logger.verbose(
              `[v1]: ONLY_CADT_SUBSCRIPTIONS: skipping validate unsubscribe for orglist org ${organization.orgUid} (sync-default-organizations owns subscription)`,
            );
          } else {
            logger.info(
              `organization ${organization.orgUid} is marked as unsubscribed. ensuring all organization stores are unsubscribed`,
            );
            await Organization.unsubscribeFromOrganizationStores(organization);
          }
        }
      }
    }
  } catch (error) {
    logger.error(
      `failed to validate default organization records and subscriptions. Error ${error.message}. ` +
        `Retrying in ${CONFIG?.APP?.TASKS?.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL || 1800} seconds`,
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
    seconds: CONFIG?.APP?.TASKS?.VALIDATE_ORGANIZATION_TABLE_TASK_INTERVAL || 1800,
    runImmediately: true,
  },
  task,
  { id: 'validate-organization-table', preventOverrun: true },
);

export default job;
