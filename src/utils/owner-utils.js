import OrganizationsV2 from '../models/v2/organizations-v2.model.js';

/**
 * Resolves an orgUid query parameter value, supporting the 'me' shorthand
 * which maps to the home organization's org_uid.
 *
 * @param {string|undefined} orgUidParam - The raw orgUid query value
 * @returns {Promise<string|null>} The resolved org_uid, or null if not provided
 * @throws {Error} If 'me' is used but no home organization is configured
 */
export async function resolveOrgUid(orgUidParam) {
  if (!orgUidParam) return null;
  if (orgUidParam === 'me') {
    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      throw new Error('No home organization configured');
    }
    return homeOrg.org_uid;
  }
  return orgUidParam;
}
