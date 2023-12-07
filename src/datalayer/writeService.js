import _ from 'lodash';

import * as dataLayer from './persistance';
import wallet from './wallet';
import fullNode from './fullNode';
import * as simulator from './simulator';
import { encodeHex } from '../utils/datalayer-utils';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.cjs';
import { Organization } from '../models';
import { publicIpv4 } from '../utils/ip-tools';

const { USE_SIMULATOR, DATALAYER_FILE_SERVER_URL } = getConfig().APP;

const createDataLayerStore = async () => {
  await wallet.waitForAllTransactionsToConfirm();

  let storeId;
  if (USE_SIMULATOR) {
    storeId = await simulator.createDataLayerStore();
  } else {
    storeId = await dataLayer.createDataLayerStore();

    logger.info(
      `Created storeId: ${storeId}, waiting for this to be confirmed on the blockchain.`,
    );
    await waitForStoreToBeConfirmed(storeId);
    await wallet.waitForAllTransactionsToConfirm();

    const chiaConfig = fullNode.getChiaConfig();

    await dataLayer.addMirror(
      storeId,
      DATALAYER_FILE_SERVER_URL ||
        `http://${await publicIpv4()}:${chiaConfig.data_layer.host_port}`,
      true,
    );
  }

  return storeId;
};

const addMirror = async (storeId, url) => {
  return dataLayer.addMirror(storeId, url);
};

const waitForStoreToBeConfirmed = async (storeId, retry = 0) => {
  if (retry > 120) {
    throw new Error(
      `Creating storeId: ${storeId} timed out. Its possible the transaction is stuck.`,
    );
  }

  const storeExistAndIsConfirmed = await dataLayer.getRoot(storeId);

  if (!storeExistAndIsConfirmed) {
    logger.info(`Still waiting for ${storeId} to confirm`);
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 30000);
    });
    return waitForStoreToBeConfirmed(storeId, retry + 1);
  }
  logger.info(`StoreId: ${storeId} has been confirmed. Congrats!`);
};

const syncDataLayer = async (storeId, data, failedCallback) => {
  logger.info(`Syncing ${storeId}`);
  const changeList = Object.keys(data).map((key) => {
    return {
      action: 'insert',
      key: encodeHex(key),
      value: encodeHex(data[key]),
    };
  });

  await pushChangesWhenStoreIsAvailable(storeId, changeList, failedCallback);
};

const upsertDataLayer = async (storeId, data) => {
  logger.info(`Syncing ${storeId}`);
  const homeOrg = await Organization.getHomeOrg();
  let changeList = Object.keys(data).map((key) => {
    const change = [];

    if (homeOrg[key]) {
      change.push({
        action: 'delete',
        key: encodeHex(key),
      });
    }

    change.push({
      action: 'insert',
      key: encodeHex(key),
      value: encodeHex(data[key]),
    });
    return change;
  });

  const finalChangeList = _.uniqBy(
    _.sortBy(_.flatten(_.values(changeList)), 'action'),
    (v) => [v.action, v.key].join(),
  );

  await pushChangesWhenStoreIsAvailable(storeId, finalChangeList);
};

const retry = (storeId, changeList, failedCallback, retryAttempts) => {
  logger.info(`Retrying pushing to store ${storeId}: ${retryAttempts}`);
  if (retryAttempts >= 60) {
    logger.info(
      'Could not push changelist to datalayer after retrying 10 times',
    );
    failedCallback();
    return;
  }

  setTimeout(async () => {
    await pushChangesWhenStoreIsAvailable(
      storeId,
      changeList,
      failedCallback,
      retryAttempts + 1,
    );
  }, 30000);
};

export const pushChangesWhenStoreIsAvailable = async (
  storeId,
  changeList,
  failedCallback = _.noop,
  retryAttempts = 0,
) => {
  if (USE_SIMULATOR) {
    return simulator.pushChangeListToDataLayer(storeId, changeList);
  } else {
    const hasUnconfirmedTransactions =
      await wallet.hasUnconfirmedTransactions();

    const storeExistAndIsConfirmed = await dataLayer.getRoot(storeId);

    if (!hasUnconfirmedTransactions && storeExistAndIsConfirmed) {
      logger.info(`pushing to datalayer ${storeId}`);

      const success = await dataLayer.pushChangeListToDataLayer(
        storeId,
        changeList,
      );

      if (!success) {
        logger.info(
          `RPC failed when pushing to store ${storeId}, attempting retry.`,
        );
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
  if (USE_SIMULATOR) {
    return simulator.dataLayerAvailable();
  } else {
    return dataLayer.dataLayerAvailable();
  }
};

const removeMirror = (storeId, coinId) => {
  return dataLayer.removeMirror(storeId, coinId);
};

const getValue = async (storeId, key) => {
  if (USE_SIMULATOR) {
    return '7b22636f6d6d656e74223a2022227d';
  } else {
    return dataLayer.getValue(storeId, key);
  }
};

export default {
  addMirror,
  createDataLayerStore,
  dataLayerAvailable,
  pushDataLayerChangeList,
  syncDataLayer,
  upsertDataLayer,
  removeMirror,
  getValue,
};
