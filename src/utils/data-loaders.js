import _ from 'lodash';
import superagent from 'superagent';
import { Governance } from '../models';
import PickListStub from '../models/governance/governance.stub.js';
import { CONFIG } from '../user-config';
import { logger } from '../logger.js';

let downloadedPickList = {};
export const getPicklistValues = () => downloadedPickList;

export const pullPickListValues = async () => {
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
};

export const getDefaultOrganizationList = async () => {
  if (CONFIG().CADT.USE_SIMULATOR || CONFIG().CADT.USE_DEVELOPMENT_MODE) {
    return [];
  } else {
    const governanceData = await Governance.findOne({
      where: { metaKey: 'orgList' },
      raw: true,
    });

    return JSON.parse(_.get(governanceData, 'metaValue', '[]'));
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
