'use strict';

/**
 * Build the set of organization UIDs that may remain subscribed when
 * ONLY_CADT_SUBSCRIPTIONS is enabled: governance orgList entries plus the
 * governance body store (needed to fetch the orgList).
 *
 * @param {Array<{ orgUid: string }>} defaultOrgList
 * @param {string|null|undefined} governanceBodyId
 * @returns {Set<string>}
 */
export const buildOrgListAllowSet = (defaultOrgList, governanceBodyId) => {
  const allowSet = new Set(
    defaultOrgList.map(({ orgUid }) => orgUid).filter(Boolean),
  );
  if (governanceBodyId) {
    allowSet.add(governanceBodyId);
  }
  return allowSet;
};

/**
 * Remove organizations that exist locally but no longer appear on the
 * governance orgList (and are not the home org or governance body): unsubscribe
 * from their DataLayer stores and delete the org plus all of its registry data.
 * Skips when defaultOrgList is empty (unsynced governance / safety guard).
 *
 * For each removed org the DataLayer unsubscribe is attempted first (only when
 * the org is still marked subscribed) so DataLayer stops syncing before the
 * local data is purged. If the unsubscribe fails the org is left in place and
 * retried on the next task run rather than orphaning the DataLayer
 * subscription. Orgs already unsubscribed locally (e.g. left behind by a prior
 * release that only flipped `subscribed: false`) are still purged so no stale
 * registry data remains for an org that is off the orgList.
 *
 * @param {object} options
 * @param {Array<{ orgUid: string }>} options.defaultOrgList
 * @param {Set<string>} options.allowSet
 * @param {import('sequelize').ModelStatic} options.organizationModel
 * @param {{ orgUid: string, isHome: string, subscribed: string }} options.fieldNames
 * @param {(organization: object) => Promise<void>} options.unsubscribeFromOrganizationStores
 * @param {(orgUid: string) => Promise<void>} options.deleteAllOrganizationData
 * @param {{ info: Function, warn: Function }} options.logger
 * @param {string} [options.apiVersionLabel]
 */
// Removing more than this many orgs in a single reconcile cycle is logged at
// warn level so a truncated/corrupt governance orgList that suddenly drops many
// orgs leaves a distinct, alertable signature rather than blending into routine
// single-org churn.
const MASS_REMOVAL_WARN_THRESHOLD = 5;

export const removeOrgsNotInOrgList = async ({
  defaultOrgList,
  allowSet,
  organizationModel,
  fieldNames,
  unsubscribeFromOrganizationStores,
  deleteAllOrganizationData,
  logger,
  apiVersionLabel = 'v2',
}) => {
  if (!defaultOrgList.length) {
    return;
  }

  const organizations = await organizationModel.findAll({ raw: true });
  let removedCount = 0;
  let failedCount = 0;
  for (const organization of organizations) {
    const orgUid = organization[fieldNames.orgUid];
    if (!orgUid || orgUid === 'PENDING') {
      continue;
    }
    if (organization[fieldNames.isHome]) {
      continue;
    }
    if (allowSet.has(orgUid)) {
      continue;
    }

    // Track which step failed so the failure log tells the on-call engineer
    // whether DataLayer was left subscribed (unsubscribe failed, no local data
    // touched) or the local purge failed after a successful unsubscribe.
    let phase = 'unsubscribe';
    try {
      if (organization[fieldNames.subscribed]) {
        await unsubscribeFromOrganizationStores(organization);
      }
      phase = 'purge';
      const purgedRowCount = await deleteAllOrganizationData(orgUid);
      removedCount += 1;
      const rowDetail =
        typeof purgedRowCount === 'number'
          ? ` (${purgedRowCount} registry rows)`
          : '';
      logger.info(
        `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: removed organization ${orgUid} and purged all of its registry data${rowDetail} (no longer on governance orgList)`,
      );
    } catch (error) {
      failedCount += 1;
      logger.warn(
        `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: failed to remove organization ${orgUid} during ${phase}: ${error.message}. Will retry on next task run.`,
      );
    }
  }

  if (removedCount > 0 || failedCount > 0) {
    const summary = `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS reconcile removed ${removedCount} organization(s) not on the governance orgList (${failedCount} failed, will retry)`;
    // Escalate when EITHER many removals or many failures occur in one cycle:
    // a truncated/corrupt orgList can surface as mass removals or, if DataLayer
    // is unreachable, as mass unsubscribe failures.
    if (
      removedCount >= MASS_REMOVAL_WARN_THRESHOLD ||
      failedCount >= MASS_REMOVAL_WARN_THRESHOLD
    ) {
      logger.warn(summary);
    } else {
      logger.info(summary);
    }
  }
};
