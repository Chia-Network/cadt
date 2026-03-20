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
  let txIds = [];
  if (USE_SIMULATOR) {
    storeId = await simulator.createDataLayerStore();
  } else {
    const result = await dataLayer.createDataLayerStore();
    storeId = result.storeId;
    txIds = result.txIds || [];

    logger.info(
      `Created storeId: ${storeId}` +
      (txIds.length > 0 ? ` (tx_ids: ${txIds.join(', ')})` : '') +
      `, waiting for this to be confirmed on the blockchain.`,
    );
    try {
      await waitForNewStoreToBeConfirmed(storeId, txIds);
    } catch (confirmError) {
      confirmError.txIds = txIds;
      throw confirmError;
    }
    await wallet.waitForAllTransactionsToConfirm();

    const mirrorUrl = await getMirrorUrl();
    if (mirrorUrl) {
      await dataLayer.addMirror(storeId, mirrorUrl, true);
    }
  }

  return { storeId, txIds };
};

/**
 * Create a DataLayer store with rejection-aware retry.
 * On rejected spend bundles, clears the rejected txs, clears pending roots,
 * waits for wallet stability, and retries.
 * Returns only the storeId (string) to callers -- tx correlation is handled internally.
 *
 * @param {number} maxRetries - Maximum number of retry attempts (default 3)
 * @returns {Promise<string>} The confirmed storeId
 */
const createDataLayerStoreWithRetry = async (maxRetries = 3) => {
  if (maxRetries < 1) {
    throw new Error('createDataLayerStoreWithRetry requires maxRetries >= 1');
  }

  if (USE_SIMULATOR) {
    const { storeId } = await createDataLayerStore();
    return storeId;
  }

  const attemptedTxIds = [];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { storeId, txIds } = await createDataLayerStore();
      attemptedTxIds.push(...txIds);
      return storeId;
    } catch (error) {
      if (error.txIds) {
        attemptedTxIds.push(...error.txIds);
      }
      const isRejection = error.message?.includes('rejected');

      if (!isRejection || attempt >= maxRetries) {
        if (attempt >= maxRetries) {
          logger.error(
            `createDataLayerStoreWithRetry: all ${maxRetries} attempts failed`,
            {
              attemptedTxIds,
              lastError: error.message,
            },
          );
        }
        throw error;
      }

      // Rejection detected -- attempt recovery
      logger.warn(
        `createDataLayerStoreWithRetry: attempt ${attempt} of ${maxRetries} ` +
        `failed with rejection, attempting recovery`,
        { error: error.message },
      );

      const dlWalletId = await wallet.getDLWalletId();
      if (dlWalletId) {
        const context =
          `createDataLayerStoreWithRetry attempt ${attempt} of ${maxRetries}`;

        const clearResult = await wallet.clearRejectedTransactions(
          dlWalletId,
          attemptedTxIds,
          context,
        );

        if (!clearResult.cleared) {
          logger.warn(
            `Could not auto-clear rejected txs: ${clearResult.reason}. ` +
            `Waiting for wallet to stabilize before retry.`,
          );
        }
      }

      // Wait for wallet to stabilize before retrying
      await wallet.waitForAllTransactionsToConfirm();
    }
  }
};

const addMirror = async (storeId, url, force = false) => {
  return dataLayer.addMirror(storeId, url, force);
};

const waitForNewStoreToBeConfirmed = async (storeId, txIds = [], retry = 0) => {
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

  if (confirmed) {
    logger.info(`StoreId: ${storeId} has been confirmed. Congrats!`);
    return;
  }

  // Check transaction health for early rejection detection
  if (txIds.length > 0) {
    try {
      const dlWalletId = await wallet.getDLWalletId();
      if (dlWalletId) {
        const health = await wallet.getTransactionHealth(dlWalletId);
        const rejectedNames = new Set(health.rejected.map((tx) => tx.name));
        const ourRejected = txIds.filter((id) => rejectedNames.has(id));

        if (ourRejected.length > 0) {
          const rejectedTx = health.rejected.find((tx) => ourRejected.includes(tx.name));
          const reason = rejectedTx?.rejectionReason || 'unknown rejection reason';
          throw new Error(
            `Store creation for ${storeId} was rejected by the network: ${reason}. ` +
            `Rejected tx_ids: ${ourRejected.join(', ')}`,
          );
        }

        // Warn if pending too long (> 10 minutes)
        if (retry > 0 && retry % 20 === 0) {
          const ourPending = [...health.inMempool, ...health.pending]
            .filter((tx) => txIds.includes(tx.name));
          if (ourPending.length > 0) {
            const ages = ourPending.map((tx) => wallet.formatDuration(tx.age));
            logger.warn(
              `Store ${storeId} creation tx(s) still unconfirmed after ${retry * 30}s. ` +
              `Tx ages: ${ages.join(', ')}. Status: ${ourPending.length} in mempool/pending.`,
            );
          }
        }
      }
    } catch (healthError) {
      // If the error is a rejection we threw above, re-throw it
      if (healthError.message?.includes('rejected by the network')) {
        throw healthError;
      }
      // Otherwise log and continue polling -- health check is best-effort
      logger.debug(`Transaction health check failed (non-fatal): ${healthError.message}`);
    }
  }

  logger.info(`Still waiting for ${storeId} to confirm (attempt ${retry + 1})`);
  await new Promise((resolve) => setTimeout(resolve, 30000));
  return waitForNewStoreToBeConfirmed(storeId, txIds, retry + 1);
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_PUSH_RETRIES = 60;

export const pushChangesWhenStoreIsAvailable = async (
  storeId,
  changeList,
  failedCallback = _.noop,
  retryAttempts = 0,
) => {
  if (USE_SIMULATOR) {
    return simulator.pushChangeListToDataLayer(storeId, changeList);
  }

  for (let attempt = retryAttempts; attempt <= MAX_PUSH_RETRIES; attempt++) {
    const syncResult = await dataLayer.getDataLayerStoreSyncStatus(storeId);
    const syncStatus = syncResult?.sync_status;
    if (syncStatus && isOwnedStoreLocalDataMissing(syncStatus)) {
      throw new Error(
        `DataLayer store ${storeId} has lost its local data. ` +
          `Local generation is 0 (empty) but the blockchain shows target generation ${syncStatus.target_generation}. ` +
          `This typically happens when the DataLayer database is deleted or reset while the wallet retains the on-chain state. ` +
          `Writing new data to this store will fail silently because DataLayer will discard it.`,
      );
    }

    const hasUnconfirmed = await wallet.hasAnyUnconfirmedTransactions();
    const { confirmed } = await dataLayer.getRoot(storeId);

    if (!hasUnconfirmed && confirmed) {
      logger.info(`pushing to datalayer ${storeId}`);

      let success;
      try {
        success = await dataLayer.pushChangeListToDataLayer(
          storeId,
          changeList,
        );
      } catch (pushError) {
        if (pushError.permanent) {
          logger.error(
            `Permanent push failure for store ${storeId}: ${pushError.message}. ` +
              `Invoking failedCallback and aborting retries.`,
          );
          await failedCallback();
          throw pushError;
        }
        throw pushError;
      }

      if (success) {
        return;
      }

      logger.error(
        `RPC failed when pushing to store ${storeId}, retrying in 30s.`,
      );
    } else {
      // Diagnose transaction health every 5 retries
      let clearedRejectedTxs = false;
      if (attempt > 0 && attempt % 5 === 0) {
        try {
          const dlWalletId = await wallet.getDLWalletId();
          const walletIds = dlWalletId ? ['1', dlWalletId] : ['1'];
          for (const wid of walletIds) {
            const health = await wallet.getTransactionHealth(wid);

            if (health.rejected.length > 0) {
              const txIds = health.rejected.map((tx) => tx.name);
              const context =
                `pushChangesWhenStoreIsAvailable for store ${storeId}, ` +
                `retry ${attempt}: detected ${health.rejected.length} rejected tx(s) in wallet ${wid}`;

              const clearResult = await wallet.clearRejectedTransactions(wid, txIds, context);
              if (clearResult.cleared) {
                logger.info(
                  `Auto-cleared rejected txs in wallet ${wid} during push to ${storeId}. ` +
                  `Re-checking readiness immediately.`,
                );
                clearedRejectedTxs = true;
                break;
              }
            }

            if (health.stuckCount > 0 || (health.oldestUnconfirmedAge && health.oldestUnconfirmedAge > 900)) {
              logger.warn(
                `Push to store ${storeId} blocked by stuck transactions in wallet ${wid}: ` +
                `${health.inMempool.length} in mempool, ${health.pending.length} pending, ` +
                `oldest age: ${wallet.formatDuration(health.oldestUnconfirmedAge)}`,
              );
            }
          }
        } catch (healthError) {
          logger.debug(`Transaction health check during push retry failed (non-fatal): ${healthError.message}`);
        }
      }

      if (clearedRejectedTxs) {
        continue;
      }
    }

    if (attempt < MAX_PUSH_RETRIES) {
      logger.info(`Retrying push to store ${storeId} in 30s (attempt ${attempt + 1}/${MAX_PUSH_RETRIES})`);
      await delay(30000);
    }
  }

  const diagnosticMsg =
    `Changes could not be pushed to store ${storeId} after ${MAX_PUSH_RETRIES} retries. ` +
    `Your wallet may have unconfirmed transactions that are stuck. ` +
    `Run 'chia wallet delete_unconfirmed_transactions -i <wallet_id>' to clear stuck transactions, then retry.`;
  logger.error(diagnosticMsg);
  await failedCallback();
  throw new Error(diagnosticMsg);
};

const pushDataLayerChangeList = (storeId, changeList, failedCallback) => {
  pushChangesWhenStoreIsAvailable(storeId, changeList, failedCallback).catch((error) => {
    logger.error(`pushDataLayerChangeList: push to ${storeId} failed after all retries: ${error.message}`);
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
  createDataLayerStore: async () => (await createDataLayerStore()).storeId,
  createDataLayerStoreWithRetry,
  dataLayerAvailable,
  pushDataLayerChangeList,
  syncDataLayer,
  upsertDataLayer,
  removeMirror,
  getValue,
  getDataLayerStoreSyncStatus,
};
