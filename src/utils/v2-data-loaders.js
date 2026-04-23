import _ from 'lodash';
import superagent from 'superagent';
import { GovernanceV2 } from '../models/v2/index.js';
import PickListStub from '../models/governance/governance-v2.stub.js';
import { getConfig } from '../utils/config-loader';
import { loggerV2 } from '../config/logger.js';

let downloadedPickListV2 = {};
export const getPicklistValuesV2 = () => downloadedPickListV2;

export const pullPickListValuesV2 = async () => {
  const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;
  if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
    downloadedPickListV2 = PickListStub;
  } else {
    try {
      const governanceData = await GovernanceV2.findOne({
        where: { meta_key: 'pickList' },
        raw: true,
      });

      if (_.get(governanceData, 'meta_value')) {
        downloadedPickListV2 = JSON.parse(governanceData.meta_value);
      } else {
        // Fallback to hardcoded picklist if governance node doesn't provide one
        loggerV2.info('[v2]: Picklist not found in governance data, using hardcoded fallback picklist');
        downloadedPickListV2 = PickListStub;
      }
    } catch (error) {
      // Fallback to hardcoded picklist on error (can't connect, parse error, etc.)
      loggerV2.warn(`[v2]: Error retrieving picklist from governance, using hardcoded fallback: ${error.message}`);
      downloadedPickListV2 = PickListStub;
    }
  }

  return downloadedPickListV2;
};

export const getDefaultOrganizationListV2 = async () => {
  // No in-function retry loop: the sync-default-organizations-v2 task calls
  // this on a scheduler cadence; on a fresh install where governance data has
  // not yet been synced, we return an empty list and let the scheduler re-run
  // us.
  const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;
  if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
    return [];
  }

  loggerV2.debug(`[v2]: getting default organization list from V2 governance data`);

  // Always check for orgList first - this allows us to pick it up if it's added later
  const governanceData = await GovernanceV2.findOne({
    where: { meta_key: 'orgList' },
    raw: true,
  });

  if (governanceData) {
    const rawOrgList = _.get(governanceData, 'meta_value', null);
    if (rawOrgList == null) {
      throw new Error('[v2]: governance orgList record is missing meta_value');
    }

    let defaultOrgList;
    try {
      defaultOrgList = JSON.parse(rawOrgList);
    } catch (error) {
      throw new Error(`[v2]: cannot parse governance orgList JSON: ${error.message}`, {
        cause: error,
      });
    }

    if (!_.isArray(defaultOrgList)) {
      throw new Error('[v2]: governance orgList must be an array');
    }

    loggerV2.debug(`[v2]: Found orgList with ${defaultOrgList.length} organizations`);
    return defaultOrgList;
  }

  // Check if governance data has been synced at all (check for pickList or glossary)
  const pickListData = await GovernanceV2.findOne({
    where: { meta_key: 'pickList' },
    raw: true,
  });
  const glossaryData = await GovernanceV2.findOne({
    where: { meta_key: 'glossary' },
    raw: true,
  });

  if (pickListData || glossaryData) {
    loggerV2.debug(
      '[v2]: Governance data exists but orgList is not available. Returning empty list. Will check again on next sync.',
    );
    return [];
  }

  loggerV2.debug(
    '[v2]: Governance data has not been synced yet. Returning empty list and waiting for the next governance sync.',
  );
  return [];
};

export const serverAvailable = async (server, port) => {
  const url = `http://${server}:${port}`;

  try {
    await superagent.get(url);
    return true;
  } catch (err) {
    if (JSON.stringify(err).includes('Python')) {
      loggerV2.info(`SERVER IS AVAILABLE ${server}`);
      return true;
    } else {
      return false;
    }
  }
};
