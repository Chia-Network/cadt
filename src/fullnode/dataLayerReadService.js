import _ from 'lodash';
import { Sequelize } from 'sequelize';

import { Meta } from '../models';
import * as dataLayer from './persistance';
import * as simulator from './simulatorV2';

const Op = Sequelize.Op;

let updateInterval;

export const startDataLayerUpdatePolling = () => {
  console.log('Start Dataayer Update Polling');
  /* updateInterval = setInterval(async () => {
    const tablesToUpdate = await dataLayerWasUpdated();
    _.keys(tablesToUpdate).forEach((tableMetaId) => {});
  }, 10000);*/
};

export const stopDataLayerUpdatePolling = () => {
  clearInterval(updateInterval);
};

export const dataLayerWasUpdated = async () => {
  const tableIdsMeta = await Meta.findAll({
    where: {
      metaKey: {
        [Op.like]: '%TableStoreId',
      },
    },
    raw: true,
  });

  const tableHashesMeta = await Meta.findAll({
    where: {
      metaKey: {
        [Op.like]: '%TableStoreHash',
      },
    },
    raw: true,
  });

  const tableHashMap = {};

  tableIdsMeta.forEach((meta) => {
    tableHashMap[meta.metaKey] = null;
  });

  tableHashesMeta.forEach((meta) => {
    const tableKey = meta.metaKey.replace('Hash', 'Id');
    tableHashMap[tableKey] = meta.metaValue;
  });

  let newHashes;
  if (process.env.USE_SIMULATOR === 'true') {
    newHashes = await simulator.getRoots(_.keys(tableHashMap));
  } else {
    newHashes = await dataLayer.getRoots(_.keys(tableHashMap));
  }

  console.log(newHashes);

  const tablesWereUpdatedMap = {};
  _.keys(tableHashMap).map((key, index) => {
    tablesWereUpdatedMap[key] = tableHashMap[key] !== newHashes[index];
  });

  return tablesWereUpdatedMap;
};
