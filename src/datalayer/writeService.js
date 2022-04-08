import _ from 'lodash';

import * as dataLayer from './persistance';
import wallet from './wallet';
import * as simulator from './simulator';
import { encodeHex } from '../utils/datalayer-utils';

import Debug from 'debug';
Debug.enable('climate-warehouse:datalayer:writeService');
const log = Debug('climate-warehouse:datalayer:writeService');

const createDataLayerStore = async () => {
  let storeId;
  if (process.env.USE_SIMULATOR === 'true') {
    storeId = await simulator.createDataLayerStore();
  } else {
    storeId = await dataLayer.createDataLayerStore();
  }

  return storeId;
};

const syncDataLayer = async (storeId, data, failedCallback) => {
  log(`Syncing ${storeId}: ${JSON.stringify(data)}`);
  const changeList = Object.keys(data).map((key) => {
    return {
      action: 'insert',
      key: encodeHex(key),
      value: encodeHex(data[key]),
    };
  });

  await pushChangesWhenStoreIsAvailable(storeId, changeList, failedCallback);
};

const retry = (storeId, changeList, failedCallback, retryAttempts) => {
  log('RETRYING...', retryAttempts);
  if (retryAttempts >= 60) {
    log('Could not push changelist to datalayer after retrying 10 times');
    failedCallback();
    return;
  }

  setTimeout(async () => {
    log('Retrying...', storeId);
    await pushChangesWhenStoreIsAvailable(
      storeId,
      changeList,
      failedCallback,
      retryAttempts + 1,
    );
  }, 30000);
};

const pushChangesWhenStoreIsAvailable = async (
  storeId,
  changeList,
  failedCallback = _.noop,
  retryAttempts = 0,
) => {
  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.pushChangeListToDataLayer(storeId, changeList);
  } else {
    const hasUnconfirmedTransactions =
      await wallet.hasUnconfirmedTransactions();

    const storeExistAndIsConfirmed = await dataLayer.getRoot(storeId);

    if (!hasUnconfirmedTransactions && storeExistAndIsConfirmed) {
      console.log('pushing to datalayer', { storeId, changeList });
      const success = await dataLayer.pushChangeListToDataLayer(
        storeId,
        changeList,
      );

      if (!success) {
        retry(storeId, changeList, failedCallback, retryAttempts);
      }
    } else {
      retry(storeId, changeList, failedCallback, retryAttempts);
    }
  }
};

const pushDataLayerChangeList = (storeId, changeList, failedCallback) => {
  pushChangesWhenStoreIsAvailable(storeId, changeList, failedCallback);
};

const dataLayerAvailable = async () => {
  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.dataLayerAvailable();
  } else {
    return dataLayer.dataLayerAvailable();
  }
};

export default {
  dataLayerAvailable,
  pushDataLayerChangeList,
  syncDataLayer,
  createDataLayerStore,
};
