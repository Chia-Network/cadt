import _ from 'lodash';
import superagent from 'superagent';
import { Governance } from '../models';
import PickListStub from '../models/governance/governance.stub.js';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.js';

let downloadedPickList = {};
export const getPicklistValues = () => downloadedPickList;

export const pullPickListValues = async () => {
  const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;
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
        logger.debug('[v1]: Picklist not found in governance data, using hardcoded fallback picklist');
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

export const getDefaultOrganizationList = async () => {
  // No in-function retry loop: the sync-default-organizations task calls this
  // on a scheduler cadence; on a fresh install where governance data has not
  // yet been synced, we return an empty list and let the scheduler re-run us.
  const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;
  if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
    return [];
  }

  logger.debug(`[v1]: getting default organization list from governance data`);
  const governanceData = await Governance.findOne({
    where: { metaKey: 'orgList' },
    raw: true,
  });

  if (governanceData) {
    const rawOrgList = _.get(governanceData, 'metaValue', null);
    if (rawOrgList == null) {
      throw new Error('[v1]: governance orgList record is missing metaValue');
    }

    let defaultOrgList;
    try {
      defaultOrgList = JSON.parse(rawOrgList);
    } catch (error) {
      throw new Error(`[v1]: cannot parse governance orgList JSON: ${error.message}`, {
        cause: error,
      });
    }

    if (!_.isArray(defaultOrgList)) {
      throw new Error('[v1]: governance orgList must be an array');
    }

    return defaultOrgList;
  }

  const governanceDataExists = (await Governance.count()) > 0;
  logger.debug(
    governanceDataExists
      ? '[v1]: Governance data exists but orgList is not available. Returning empty list. Will check again on next sync.'
      : '[v1]: Governance data has not been synced yet. Returning empty list and waiting for the next governance sync.',
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
      logger.info(`SERVER IS AVAILABLE ${server}`);
      return true;
    } else {
      return false;
    }
  }
};
