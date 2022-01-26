import * as dataLayer from './persistance';
import * as simulator from './simulator';

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
      key,
      value: data[key],
    };
  });

  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.pushChangeListToDataLayer(storeId, changeList);
  } else {
    return dataLayer.pushChangeListToDataLayer(storeId, changeList);
  }
};

export const pushDataLayerChangeList = async (storeId, changeList) => {
  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.pushChangeListToDataLayer(storeId, changeList);
  } else {
    return dataLayer.pushChangeListToDataLayer(storeId, changeList);
  }
};
