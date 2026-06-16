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
 * governance orgList (and are not the home org or governance body). Removal is
 * phased across task runs: unsubscribe first, then wait for DataLayer to confirm
 * the stores are no longer subscribed, then purge after the configured grace
 * cycle count.
 *
 * @param {object} options
 * @param {Array<{ orgUid: string }>} options.defaultOrgList
 * @param {Set<string>} options.allowSet
 * @param {import('sequelize').ModelStatic} options.organizationModel
 * @param {{ orgUid: string, isHome: string, subscribed: string }} options.fieldNames
 * @param {(organization: object) => Promise<void>} options.unsubscribeFromOrganizationStores
 * @param {(organization: object) => Promise<boolean>} options.isStoreUnsubscribed
 * @param {(orgUid: string) => Promise<number|void>} options.deleteAllOrganizationData
 * @param {{ info: Function, warn: Function, debug?: Function }} options.logger
 * @param {string} [options.apiVersionLabel]
 * @param {number|string} [options.graceCycles]
 */
// Removing more than this many orgs in a single reconcile cycle is logged at
// warn level so a truncated/corrupt governance orgList that suddenly drops many
// orgs leaves a distinct, alertable signature rather than blending into routine
// single-org churn.
const MASS_REMOVAL_WARN_THRESHOLD = 5;
const DEFAULT_PURGE_GRACE_CYCLES = 3;
const offOrgListStreaksByVersion = new Map();

export const resolvePurgeGraceCycles = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PURGE_GRACE_CYCLES;
};

const getVersionStreaks = (apiVersionLabel) => {
  if (!offOrgListStreaksByVersion.has(apiVersionLabel)) {
    offOrgListStreaksByVersion.set(apiVersionLabel, new Map());
  }
  return offOrgListStreaksByVersion.get(apiVersionLabel);
};

export const resetOrgListReconcileState = (apiVersionLabel) => {
  if (apiVersionLabel) {
    offOrgListStreaksByVersion.delete(apiVersionLabel);
    return;
  }
  offOrgListStreaksByVersion.clear();
};

export const removeOrgsNotInOrgList = async ({
  defaultOrgList,
  allowSet,
  organizationModel,
  fieldNames,
  unsubscribeFromOrganizationStores,
  isStoreUnsubscribed,
  deleteAllOrganizationData,
  logger,
  apiVersionLabel = 'v2',
  graceCycles,
}) => {
  if (!defaultOrgList.length) {
    return;
  }
  if (typeof isStoreUnsubscribed !== 'function') {
    throw new Error('isStoreUnsubscribed is required');
  }

  const resolvedGraceCycles = resolvePurgeGraceCycles(graceCycles);
  const organizations = await organizationModel.findAll({ raw: true });
  const streaks = getVersionStreaks(apiVersionLabel);
  let removedCount = 0;
  let deferredCount = 0;
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
      streaks.delete(orgUid);
      continue;
    }

    let phase = 'unsubscribe';
    try {
      if (organization[fieldNames.subscribed]) {
        streaks.delete(orgUid);
        await unsubscribeFromOrganizationStores(organization);
        logger.info(
          `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: unsubscribed organization ${orgUid}; purge deferred until unsubscribe is confirmed for ${resolvedGraceCycles} reconcile cycle(s)`,
        );
        deferredCount += 1;
        continue;
      }

      phase = 'confirm-unsubscribed';
      const unsubscribed = await isStoreUnsubscribed(organization);
      if (!unsubscribed) {
        streaks.delete(orgUid);
        logger.debug?.(
          `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: organization ${orgUid} is still subscribed in DataLayer; purge deferred`,
        );
        deferredCount += 1;
        continue;
      }

      const nextStreak = (streaks.get(orgUid) || 0) + 1;
      streaks.set(orgUid, nextStreak);

      if (nextStreak < resolvedGraceCycles) {
        logger.info(
          `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: organization ${orgUid} remains off the governance orgList while unsubscribed for ${nextStreak}/${resolvedGraceCycles} reconcile cycle(s); purge deferred`,
        );
        deferredCount += 1;
        continue;
      }

      phase = 'purge';
      const purgedRowCount = await deleteAllOrganizationData(orgUid);
      streaks.delete(orgUid);
      removedCount += 1;
      const rowDetail =
        typeof purgedRowCount === 'number'
          ? ` (${purgedRowCount} rows)`
          : '';
      logger.info(
        `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: removed organization ${orgUid} and purged all of its local data${rowDetail} (no longer on governance orgList)`,
      );
    } catch (error) {
      if (phase === 'confirm-unsubscribed') {
        streaks.delete(orgUid);
      }
      failedCount += 1;
      logger.warn(
        `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: failed to remove organization ${orgUid} during ${phase}: ${error.message}. Will retry on next task run.`,
      );
    }
  }

  if (removedCount > 0 || deferredCount > 0 || failedCount > 0) {
    const summary = `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS reconcile handled off-orgList organization(s): ${removedCount} removed, ${deferredCount} deferred, ${failedCount} failed`;
    // Escalate when many off-orgList orgs are removed, deferred, or fail in one
    // cycle: a truncated/corrupt orgList can surface before the purge phase.
    if (
      removedCount >= MASS_REMOVAL_WARN_THRESHOLD ||
      deferredCount >= MASS_REMOVAL_WARN_THRESHOLD ||
      failedCount >= MASS_REMOVAL_WARN_THRESHOLD
    ) {
      logger.warn(summary);
    } else {
      logger.info(summary);
    }
  }
};
