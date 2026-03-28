import _ from 'lodash';
import superagent from 'superagent';
import { GovernanceV2 } from '../models/v2/index.js';
import PickListStub from '../models/governance/governance-v2.stub.js';
import { getConfig } from '../utils/config-loader';
import { loggerV2 } from '../config/logger.js';

const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;

let downloadedPickListV2 = {};
export const getPicklistValuesV2 = () => downloadedPickListV2;

export const pullPickListValuesV2 = async () => {
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

export const getDefaultOrganizationListV2 = async (retryCount = 0) => {
  // need retry because on new install governance data may not have been synced yet
  const maxRetry = 50;

  try {
    if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
      return [];
    } else {
      loggerV2.debug(`[v2]: getting default organization list from V2 governance data`);

      // Always check for orgList first - this allows us to pick it up if it's added later
      const governanceData = await GovernanceV2.findOne({
        where: { meta_key: 'orgList' },
        raw: true,
      });

      if (governanceData) {
        const defaultOrgList = JSON.parse(
          _.get(governanceData, 'meta_value', null),
        );
        if (defaultOrgList && _.isArray(defaultOrgList)) {
          loggerV2.debug(`[v2]: Found orgList with ${defaultOrgList.length} organizations`);
          return defaultOrgList;
        }
      }

      // Check if governance data has been synced at all (check for pickList or glossary)
      // This check is only used to determine if we should retry waiting for initial sync
      const pickListData = await GovernanceV2.findOne({
        where: { meta_key: 'pickList' },
        raw: true,
      });
      const glossaryData = await GovernanceV2.findOne({
        where: { meta_key: 'glossary' },
        raw: true,
      });

      if (pickListData || glossaryData) {
        // Governance data exists but orgList is missing - return empty array
        // The task will check again on its next run, so if orgList is added later, it will be picked up
        loggerV2.debug(
          '[v2]: Governance data exists but orgList is not available. Returning empty list. Will check again on next sync.',
        );
        return [];
      }

      // Governance data hasn't been synced yet - retry to wait for initial sync
      throw new Error(
        'V2 governance data has not been synced yet. Waiting for initial governance sync.',
      );
    }
  } catch (error) {
    if (retryCount >= maxRetry) {
      // After max retries, if governance data still doesn't exist, return empty array
      // This prevents infinite retries if governance node doesn't provide orgList
      loggerV2.warn(
        `[v2]: Max retries reached for getting org list. Governance sync may not have completed yet. Returning empty list. Error: ${error.message}`,
      );
      return [];
    }

    loggerV2.warn(`[v2]: cannot get default org list from V2. trying again Error: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return getDefaultOrganizationListV2(retryCount + 1);
  }
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
