import _ from 'lodash';
import superagent from 'superagent';
import { Governance } from '../models';
import PickListStub from '../models/governance/governance.stub.js';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.js';

const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;

let downloadedPickList = {};
export const getPicklistValues = () => downloadedPickList;

export const pullPickListValues = async () => {
  if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
    downloadedPickList = PickListStub;
  } else {
    try {
      const governanceData = await Governance.findOne({
        where: { metaKey: 'pickList' },
        raw: true,
      });

      if (_.get(governanceData, 'metaValue')) {
        downloadedPickList = JSON.parse(governanceData.metaValue);
      } else {
        // Fallback to hardcoded picklist if governance node doesn't provide one
        logger.info('[v1]: Picklist not found in governance data, using hardcoded fallback picklist');
        downloadedPickList = PickListStub;
      }
    } catch (error) {
      // Fallback to hardcoded picklist on error (can't connect, parse error, etc.)
      logger.warn(`[v1]: Error retrieving picklist from governance, using hardcoded fallback: ${error.message}`);
      downloadedPickList = PickListStub;
    }
  }

  return downloadedPickList;
};

export const getDefaultOrganizationList = async (retryCount = 0) => {
  // need retry because on new install governance data may not have been synced yet
  let maxRetry = 50;

  try {
    if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
      return [];
    } else {
      logger.debug(`[v1]: getting default organization list from governance data`);
      const governanceData = await Governance.findOne({
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
        'governance data does not contain a default organization list',
      );
    }
  } catch (error) {
    if (retryCount >= maxRetry) {
      throw error;
    }

    logger.warn(`[v1]: cannot get default org list. trying again Error: ${error}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return getDefaultOrganizationList((retryCount += 1));
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
