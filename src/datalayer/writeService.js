import _ from 'lodash';

import * as dataLayer from './persistance';
import wallet from './wallet';
import * as simulator from './simulator';
import {
  encodeHex,
  getMirrorUrl,
  isOwnedStoreLocalDataMissing,
} from '../utils/datalayer-utils';
import { getConfig } from '../utils/config-loader';
import { logger } from '../config/logger.js';
import { Organization } from '../models';

const { USE_SIMULATOR } = getConfig().APP;

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
    await waitForNewStoreToBeConfirmed(storeId);
    await wallet.waitForAllTransactionsToConfirm();

    const mirrorUrl = await getMirrorUrl();
    if (mirrorUrl) {
      await dataLayer.addMirror(storeId, mirrorUrl, true);
    }
  }

  return storeId;
};

const addMirror = async (storeId, url, force = false) => {
  return dataLayer.addMirror(storeId, url, force);
};

const waitForNewStoreToBeConfirmed = async (storeId, retry = 0) => {
  // In simulator mode, stores are immediately confirmed
  if (USE_SIMULATOR) {
    logger.info(`StoreId: ${storeId} confirmed (simulator mode)`);
    return;
  }

  if (retry > 120) {
    throw new Error(
      `Creating storeId: ${storeId} timed out. Its possible the transaction is stuck.`,
    );
  }

  const { confirmed } = await dataLayer.getRoot(storeId);

  if (!confirmed) {
    logger.info(`Still waiting for ${storeId} to confirm`);
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 30000);
    });
    return waitForNewStoreToBeConfirmed(storeId, retry + 1);
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

/**
 * Schedule a retry after 30s (fire-and-forget). Does not block the caller.
 * Caller should throw so we don't mark "data written" until the push actually succeeds.
 */
const retryPushToStore = (
  storeId,
  changeList,
  failedCallback,
  retryAttempts,
) => {
  logger.info(`Retrying pushing to store ${storeId} in 30s (attempt ${retryAttempts + 1})`);
  if (retryAttempts >= 60) {
    logger.info(
      'Could not push changelist to datalayer after retrying 60 times',
    );
    failedCallback();
    return;
  }

  setTimeout(() => {
    pushChangesWhenStoreIsAvailable(
      storeId,
      changeList,
      failedCallback,
      retryAttempts + 1,
    ).catch((error) => {
      logger.error(`Retry push to store ${storeId} failed: ${error.message}`);
    });
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
    const syncResult =
      await dataLayer.getDataLayerStoreSyncStatus(storeId);
    const syncStatus = syncResult?.sync_status;
    if (syncStatus && isOwnedStoreLocalDataMissing(syncStatus)) {
      throw new Error(
        `DataLayer store ${storeId} has lost its local data. ` +
          `Local generation is 0 (empty) but the blockchain shows target generation ${syncStatus.target_generation}. ` +
          `This typically happens when the DataLayer database is deleted or reset while the wallet retains the on-chain state. ` +
          `Writing new data to this store will fail silently because DataLayer will discard it.`,
      );
    }

    const hasUnconfirmedTransactions =
      await wallet.hasUnconfirmedTransactions();

    const { confirmed } = await dataLayer.getRoot(storeId);

    if (!hasUnconfirmedTransactions && confirmed) {
      logger.info(`pushing to datalayer ${storeId}`);

      const success = await dataLayer.pushChangeListToDataLayer(
        storeId,
        changeList,
      );

      if (!success) {
        logger.error(
          `RPC failed when pushing to store ${storeId}, scheduling retry in 30s.`,
        );
        retryPushToStore(
          storeId,
          changeList,
          failedCallback,
          retryAttempts,
        );
        throw new Error(
          `Push to store ${storeId} failed (spendable/blockchain). Retry scheduled in 30s.`,
        );
      }
    } else {
      retryPushToStore(
        storeId,
        changeList,
        failedCallback,
        retryAttempts,
      );
      throw new Error(
        `Store ${storeId} not ready for push (unconfirmed tx or root). Retry scheduled in 30s.`,
      );
    }
  }
};

const pushDataLayerChangeList = (storeId, changeList, failedCallback) => {
  pushChangesWhenStoreIsAvailable(storeId, changeList, failedCallback).catch((error) => {
    // Fire-and-forget callers don't await this, so catch here to avoid unhandled rejections.
    // The retry is already scheduled inside pushChangesWhenStoreIsAvailable.
    logger.debug(`pushDataLayerChangeList: push to ${storeId} deferred to retry: ${error.message}`);
  });
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

const getDataLayerStoreSyncStatus = (storeId) => {
  return dataLayer.getDataLayerStoreSyncStatus(storeId);
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
  getDataLayerStoreSyncStatus,
};
