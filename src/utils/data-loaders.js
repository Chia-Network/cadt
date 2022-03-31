import _ from 'lodash';

import request from 'request-promise';

import { Governance } from '../models';
import PickListStub from '../models/governance/governance.stub.json';

let downloadedPickList = {};
export const getPicklistValues = () => downloadedPickList;

export const pullPickListValues = async () => {
  if (
    process.env.USE_SIMULATOR === 'true' ||
    process.env.CHIA_NETWORK === 'testnet'
  ) {
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
};

export const getDefaultOrganizationList = async () => {
  if (
    process.env.USE_SIMULATOR === 'true' ||
    process.env.CHIA_NETWORK === 'testnet'
  ) {
    const options = {
      method: 'GET',
      url: process.env.TESTNET_DEFAULT_ORGANIZATIONS,
    };

    return JSON.parse(await request(Object.assign({}, options)));
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
      console.log('SERVER IS AVAILABLE', server);
      return true;
    } else {
      return false;
    }
  }
};
