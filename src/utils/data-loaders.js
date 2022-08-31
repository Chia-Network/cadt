import _ from 'lodash';

import request from 'request-promise';

import { Governance } from '../models';
import PickListStub from '../models/governance/governance.stub.json';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.cjs';

const { USE_SIMULATOR, CHIA_NETWORK } = getConfig().APP;

let downloadedPickList = {};
export const getPicklistValues = () => downloadedPickList;

export const pullPickListValues = async () => {
  if (USE_SIMULATOR || CHIA_NETWORK === 'testnet') {
    downloadedPickList = PickListStub;
  } else {
    const goveranceData = await Governance.findOne({
      where: { metaKey: 'pickList' },
      raw: true,
    });

    if (_.get(goveranceData, 'metaValue')) {
      downloadedPickList = JSON.parse(goveranceData.metaValue);
    }
  }

  return downloadedPickList;
};

export const getDefaultOrganizationList = async () => {
  if (USE_SIMULATOR || CHIA_NETWORK === 'testnet') {
    return [];
  } else {
    const goveranceData = await Governance.findOne({
      where: { metaKey: 'orgList' },
      raw: true,
    });

    return JSON.parse(_.get(goveranceData, 'metaValue', '[]'));
  }
};

export const serverAvailable = async (server, port) => {
  const options = {
    method: 'GET',
    url: `http://${server}:${port}`,
  };

  try {
    await request(Object.assign({}, options));
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
