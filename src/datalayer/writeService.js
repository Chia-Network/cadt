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
  console.log(`Syncing ${storeId}: ${JSON.stringify(data)}`);
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
  const retry = () => {
    setTimeout(async () => {
      console.log('Retrying...');
      await pushChangesWhenStoreIsAvailable(storeId, changeList);
    }, 5000);
  };

  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.pushChangeListToDataLayer(storeId, changeList);
  } else {
    const storeExistAndIsConfirmed = await dataLayer.getRoot(storeId);
    if (storeExistAndIsConfirmed) {
      const success = await dataLayer.pushChangeListToDataLayer(
        storeId,
        changeList,
      );
      if (!success) {
        retry();
      }
    } else {
      retry();
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

export const dataLayerAvailable = async () => {
  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.dataLayerAvailable();
  } else {
    return dataLayer.dataLayerAvailable();
  }
};
