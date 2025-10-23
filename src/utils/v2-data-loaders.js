import _ from 'lodash';
import superagent from 'superagent';
import { GovernanceV2 } from '../models/v2/index.js';
import PickListV2Stub from '../models/governance/governance-v2.stub.js';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.js';

const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;

let downloadedPickListV2 = {};
export const getPicklistValuesV2 = () => downloadedPickListV2;

export const pullPickListValuesV2 = async () => {
  if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
    downloadedPickListV2 = PickListV2Stub;
  } else {
    const governanceData = await GovernanceV2.findOne({
      where: { metaKey: 'pickList' },
      raw: true,
    });

    if (_.get(governanceData, 'metaValue')) {
      downloadedPickListV2 = JSON.parse(governanceData.metaValue);
    }
  }

  return downloadedPickListV2;
};

export const getDefaultOrganizationListV2 = async (retryCount = 0) => {
  // need retry because on new install governance data may not have been synced yet
  let maxRetry = 50;

  try {
    if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
      return [];
    } else {
      logger.debug(`getting default organization list from V2 governance data`);
      const governanceData = await GovernanceV2.findOne({
        where: { metaKey: 'orgList' },
        raw: true,
      });

      if (governanceData) {
        const defaultOrgList = JSON.parse(
          _.get(governanceData, 'metaValue', null),
        );
        if (defaultOrgList && _.isArray(defaultOrgList)) {
          return defaultOrgList;
        }
      }

      throw new Error(
        'V2 governance data does not contain a default organization list',
      );
    }
  } catch (error) {
    if (retryCount >= maxRetry) {
      throw error;
    }

    logger.warn(`cannot get default org list from V2. trying again Error: ${error}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return getDefaultOrganizationListV2((retryCount += 1));
  }
};

export const serverAvailable = async (server, port) => {
  const url = `http://${server}:${port}`;

  try {
    await superagent.get(url);
    return true;
  } catch (err) {
    if (JSON.stringify(err).includes('Python')) {
      logger.info(`SERVER IS AVAILABLE ${server}`);
      return true;
    } else {
      return false;
    }
  }
};
