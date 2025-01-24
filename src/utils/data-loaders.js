import _ from 'lodash';
import superagent from 'superagent';
import { Governance } from '../models';
import PickListStub from '../models/governance/governance.stub.js';
import { CONFIG } from '../user-config';
import { logger } from '../logger.js';

let downloadedPickList = {};
export const getPicklistValues = () => downloadedPickList;

export const pullPickListValues = async () => {
  try {
    if (CONFIG().CADT.USE_SIMULATOR || CONFIG().CADT.USE_DEVELOPMENT_MODE) {
      downloadedPickList = PickListStub;
    } else {
      const governanceData = await Governance.findOne({
        where: { metaKey: 'pickList' },
        raw: true,
      });

      if (_.get(governanceData, 'metaValue')) {
        downloadedPickList = JSON.parse(governanceData.metaValue);
      }
    }

    return downloadedPickList;
  } catch (error) {
    logger.error(error);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return pullPickListValues();
  }
};

export const getDefaultOrganizationList = async (retryCount = 0) => {
  // need retry because on new install governance data may not have been synced yet
  let maxRetry = 50;

  try {
    if (CONFIG().CADT.USE_SIMULATOR || CONFIG().CADT.USE_DEVELOPMENT_MODE) {
      return [];
    } else {
      logger.debug(`getting default organization list from governance data`);
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

    logger.warn(`cannot get default org list. trying again Error: ${error}`);
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
