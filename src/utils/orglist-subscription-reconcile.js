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
 * Unsubscribe from organizations that are subscribed locally but no longer
 * appear on the governance orgList (and are not the home org or governance body).
 * Skips when defaultOrgList is empty (unsynced governance / safety guard).
 *
 * @param {object} options
 * @param {Array<{ orgUid: string }>} options.defaultOrgList
 * @param {Set<string>} options.allowSet
 * @param {import('sequelize').ModelStatic} options.organizationModel
 * @param {{ orgUid: string, isHome: string, subscribed: string }} options.fieldNames
 * @param {(organization: object) => Promise<void>} options.unsubscribeFromOrganizationStores
 * @param {{ info: Function, warn: Function }} options.logger
 * @param {string} [options.apiVersionLabel]
 */
export const unsubscribeOrgsNotInOrgList = async ({
  defaultOrgList,
  allowSet,
  organizationModel,
  fieldNames,
  unsubscribeFromOrganizationStores,
  logger,
  apiVersionLabel = 'v2',
}) => {
  if (!defaultOrgList.length) {
    return;
  }

  const organizations = await organizationModel.findAll({ raw: true });
  for (const organization of organizations) {
    const orgUid = organization[fieldNames.orgUid];
    if (!orgUid) {
      continue;
    }
    if (organization[fieldNames.isHome]) {
      continue;
    }
    if (allowSet.has(orgUid)) {
      continue;
    }
    const isSubscribed = Boolean(organization[fieldNames.subscribed]);
    if (!isSubscribed) {
      continue;
    }

    try {
      await unsubscribeFromOrganizationStores(organization);
      logger.info(
        `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: unsubscribed organization ${orgUid} (removed from governance orgList)`,
      );
    } catch (error) {
      logger.warn(
        `[${apiVersionLabel}]: ONLY_CADT_SUBSCRIPTIONS: failed to unsubscribe organization ${orgUid}: ${error.message}. Will retry on next task run.`,
      );
    }
  }
};
