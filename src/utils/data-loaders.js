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

export const getDefaultOrganizationList = async () => {
  try {
    if (CONFIG().CADT.USE_SIMULATOR || CONFIG().CADT.USE_DEVELOPMENT_MODE) {
      return [];
    } else {
      const governanceData = await Governance.findOne({
        where: { metaKey: 'orgList' },
        raw: true,
      });

      return JSON.parse(_.get(governanceData, 'metaValue', '[]'));
    }
  } catch (error) {
    logger.error(error);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return getDefaultOrganizationList();
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
