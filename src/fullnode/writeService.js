import * as dataLayer from './persistance';
import * as simulator from './simulator';
import { encodeHex } from '../utils/datalayer-utils';

export const createDataLayerStore = async () => {
  let storeId;
  if (process.env.USE_SIMULATOR === 'true') {
    storeId = await simulator.createDataLayerStore();
  } else {
    storeId = await dataLayer.createDataLayerStore();
  }

  return storeId;
};

export const syncDataLayer = async (storeId, data) => {
  const changeList = Object.keys(data).map((key) => {
    return {
      action: 'insert',
      key: encodeHex(key),
      value: encodeHex(data[key]),
    };
  });

  await pushChangesWhenStoreIsAvailable(storeId, changeList);
};

const pushChangesWhenStoreIsAvailable = async (storeId, changeList) => {
  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.pushChangeListToDataLayer(storeId, changeList);
  } else {
    const storeExists = await dataLayer.getRoot(storeId);
    if (storeExists) {
      return dataLayer.pushChangeListToDataLayer(storeId, changeList);
    } else {
      setTimeout(async () => {
        await pushChangesWhenStoreIsAvailable(storeId, changeList);
      }, 10000);
    }
  }
};

export const pushDataLayerChangeList = (storeId, changeList) => {
  pushChangesWhenStoreIsAvailable(storeId, changeList);
};

export const subscribeToStore = async (storeId) => {
  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.subscribeToStore(storeId);
  } else {
    return dataLayer.subscribeToStore(storeId);
  }
};
