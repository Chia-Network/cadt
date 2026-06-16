'use strict';

import { Model } from 'sequelize';
import _ from 'lodash';

import { sequelize } from '../../database';

import datalayer from '../../datalayer';
import wallet from '../../datalayer/wallet.js';
import { logger } from '../../config/logger';
import { Audit, FileStore, Meta, ModelKeys, Staging } from '../';
import { getConfig } from '../../utils/config-loader';
import {
  destroyByPrimaryKeyBatches,
  resolveDeleteBatchSize,
} from '../../utils/batched-delete.js';
const { USE_SIMULATOR, AUTO_SUBSCRIBE_FILESTORE } = getConfig().APP;

import ModelTypes from './organizations.modeltypes.js';
import { assertStoreIsOwned } from '../../utils/data-assertions';
import {
  getRoot,
  getLocalRoot,
  getSubscriptions,
  getDataLayerStoreSyncStatus,
  pushChangeListToDataLayer,
} from '../../datalayer/persistance.js';
import {
  addOrDeleteOrganizationRecordMutex,
  processingSyncRegistriesTransactionMutex,
} from '../../utils/model-utils';
import { isDlStoreSynced, encodeHex } from '../../utils/datalayer-utils';
import {
  ORG_CREATION_STATES,
  STORE_TYPES,
  ORG_CREATION_CONFIG,
  createInitialState,
  updateState,
  markStoreCreated,
  markStoreConfirmed,
  markStoreDataWritten,
  allStoresCreated,
  allStoresConfirmed,
  allDataWritten,
  getStoresToCreate,
  getStoresAwaitingConfirmation,
  getStoresNeedingData,
  hasTimedOut,
  incrementRetryCount,
  hasExceededMaxRetries,
  markAsFailed,
  getStatusSummary,
  logState,
  saveCreationState,
  loadCreationState,
  clearCreationState,
  hasInProgressCreation,
  createIncrementalStateWriter,
} from '../../utils/organization-creation-state.js';
import { mirrorOrgStores } from '../../tasks/mirror-check.js';
import { updateOrgLockStatus } from '../../utils/org-operation-lock.js';

const { isTransientWalletError } = wallet;

class Organization extends Model {
  static async getHomeOrg(includeAddress = true) {
    const { READ_ONLY } = getConfig();
    const myOrganization = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    if (myOrganization && myOrganization.metadata) {
      const parsedMetadata = JSON.parse(myOrganization.metadata);

      // Add each key from parsedMetadata to myOrganization
      for (const key in parsedMetadata) {
        if (Object.prototype.hasOwnProperty.call(parsedMetadata, key)) {
          myOrganization[key] = parsedMetadata[key];
        }
      }

      // Optionally, you can delete the original metadata property
      delete myOrganization.metadata;
    }

    if (myOrganization && includeAddress) {
      if (!READ_ONLY) {
        myOrganization.xchAddress = await datalayer.getPublicAddress();
      }
      myOrganization.fileStoreSubscribed = true;
      return myOrganization;
    }

    if (myOrganization) {
      const pendingCommitsCount = await Staging.count({
        where: { commited: true },
      });

      myOrganization.synced =
        myOrganization.synced === 1 && pendingCommitsCount === 0;
    }

    return myOrganization;
  }

  static async getOrgsMap() {
    const { READ_ONLY } = getConfig();
    logger.silly(
      '[MIRROR_DEBUG] Starting getOrgsMap() - querying organizations from database',
    );

    const organizations = await Organization.findAll({
      attributes: [
        'orgUid',
        'orgHash',
        'name',
        'icon',
        'isHome',
        'subscribed',
        'synced',
        'fileStoreId',
        'fileStoreSubscribed',
        'registryId',
        'registryHash',
        'sync_remaining',
        'dataModelVersionStoreId',
        'dataModelVersionStoreHash',
      ],
    });

    logger.silly(
      `[MIRROR_DEBUG] Found ${organizations.length} organizations in database`,
    );

    for (let i = 0; i < organizations.length; i++) {
      if (organizations[i].dataValues.isHome) {
        if (!READ_ONLY) {
          organizations[i].dataValues.xchAddress =
            await datalayer.getPublicAddress();
          organizations[i].dataValues.balance =
            await datalayer.getWalletBalance();
        }

        const pendingCommitsCount = await Staging.count({
          where: { commited: true },
        });

        organizations[i].dataValues.synced =
          organizations[i].dataValues.synced === true &&
          pendingCommitsCount === 0;
        break;
      }
    }

    const orgsMap = organizations.reduce((map, current) => {
      map[current.orgUid] = current.dataValues;
      logger.silly(
        `[MIRROR_DEBUG] Added to map - orgUid: ${current.orgUid}, name: ${current.dataValues.name}, subscribed: ${current.dataValues.subscribed}`,
      );
      return map;
    }, {});

    logger.silly(
      `[MIRROR_DEBUG] Returning organizations map with ${Object.keys(orgsMap).length} entries`,
    );
    return orgsMap;
  }

  /**
   * Create a V1 home organization
   * Uses parallel store creation for faster organization setup.
   *
   * @param {string} name - Organization name
   * @param {string} icon - Organization icon (base64 string)
   * @param {string} dataVersion - Data version (defaults to 'v1')
   * @returns {Promise<string>} The new organization UID
   */
  static async createHomeOrganization(name, icon, dataVersion = 'v1', lockToken = null) {
    try {
      logger.info('[v1]: Creating New Organization using parallel store creation.');

      // Ensure name is provided
      if (!name) {
        throw new Error('Organization name is required');
      }

      // Icon is optional - use provided value or default to empty string
      const iconValue = icon !== undefined && icon !== null ? icon : '';

      // Check for existing home org
      const myOrganization = await Organization.getHomeOrg();
      if (myOrganization && myOrganization.orgUid !== 'PENDING') {
        logger.info('[v1]: Home organization already exists');
        return myOrganization.orgUid;
      }

      // Check for in-progress creation (for recovery)
      let state = await loadCreationState(Meta, 'v1');
      if (state && state.state !== ORG_CREATION_STATES.COMPLETE && state.state !== ORG_CREATION_STATES.FAILED) {
        logger.info('[v1]: Found in-progress organization creation, resuming...');
        return await Organization._resumeOrganizationCreation(state, lockToken);
      }

      // Initialize state for new creation
      state = createInitialState(name, iconValue, dataVersion, 'v1');
      await saveCreationState(state, Meta);

      // Create PENDING record in database
      const existingPending = await Organization.findOne({
        where: { orgUid: 'PENDING' },
        raw: true,
      });

      if (!existingPending) {
        await Organization.create({
          orgUid: 'PENDING',
          registryId: null,
          modelVersionStoreId: null,
          isHome: true,
          subscribed: false,
          name: '',
          icon: '',
        });
      }

      if (!USE_SIMULATOR) {
        const coinCheck = await wallet.waitForSpendableCoins(4);
        logger.info(`[v1]: Proceeding with org creation, ${coinCheck.coinCount} coins available`);
      }

      // Execute the creation process
      return await Organization._executeOrganizationCreation(state, lockToken);
    } catch (error) {
      logger.error(
        `[v1]: create organization process failed. Error: ${error.message}`,
      );
      // Mark state as FAILED BEFORE destroying PENDING record to ensure
      // the state is persisted even if the destroy call causes issues.
      try {
        let failedState = await loadCreationState(Meta, 'v1');
        if (failedState && failedState.state !== ORG_CREATION_STATES.COMPLETE) {
          failedState = markAsFailed(failedState, error.message);
          await saveCreationState(failedState, Meta);
          logger.info('[v1]: Creation state marked as FAILED in Meta table');
        }
      } catch (stateError) {
        logger.error(`[v1]: Failed to mark creation state as FAILED: ${stateError.message}`);
      }
      try {
        await Organization.destroy({ where: { orgUid: 'PENDING' } });
      } catch (destroyError) {
        logger.error(`[v1]: Failed to destroy PENDING record: ${destroyError.message}`);
      }
      throw error;
    }
  }

  /**
   * Resume an in-progress organization creation (for crash recovery)
   * @param {Object} state - The saved state object
   * @returns {Promise<string>} The organization UID
   * @private
   */
  static async _resumeOrganizationCreation(state, lockToken = null) {
    logState(state, `Resuming from state: ${state.state}`);

    // Check for timeout
    if (hasTimedOut(state)) {
      state = incrementRetryCount(state);
      if (hasExceededMaxRetries(state)) {
        state = markAsFailed(state, 'Organization creation timed out after maximum retries');
        await saveCreationState(state, Meta);
        await Organization.destroy({ where: { orgUid: 'PENDING' } });
        throw new Error('Organization creation failed: timed out after maximum retries');
      }
      // Reset startedAt for new retry attempt
      state = updateState(state, { startedAt: new Date().toISOString() });
      await saveCreationState(state, Meta);
    }

    const neededCoins = getStoresToCreate(state).length;
    if (!USE_SIMULATOR && neededCoins > 0) {
      const coinCheck = await wallet.waitForSpendableCoins(neededCoins);
      logger.info(`[v1]: Resuming org creation, ${coinCheck.coinCount} coins available (need ${neededCoins})`);
    }

    return await Organization._executeOrganizationCreation(state, lockToken);
  }

  /**
   * Execute the organization creation process from the current state
   * @param {Object} state - The current state object
   * @returns {Promise<string>} The organization UID
   * @private
   */
  static async _executeOrganizationCreation(state, lockToken = null) {
    try {
      // PHASE 1: Create stores in parallel
      if (state.state === ORG_CREATION_STATES.INITIALIZING ||
          state.state === ORG_CREATION_STATES.STORES_CREATING) {
        updateOrgLockStatus(lockToken, 'Creating stores on blockchain');
        state = updateState(state, { state: ORG_CREATION_STATES.STORES_CREATING });
        await saveCreationState(state, Meta);

        state = await Organization._createStoresInParallel(state);
      }

      // Wait for all stores to be confirmed
      if (state.state === ORG_CREATION_STATES.STORES_CREATING) {
        updateOrgLockStatus(lockToken, 'Waiting for stores to confirm on blockchain');
        state = await Organization._waitForStoresConfirmation(state);
      }

      // PHASE 2: Push data to stores in parallel
      if (state.state === ORG_CREATION_STATES.STORES_CONFIRMED ||
          state.state === ORG_CREATION_STATES.DATA_PUSHING) {
        updateOrgLockStatus(lockToken, 'Writing data to stores');
        state = updateState(state, { state: ORG_CREATION_STATES.DATA_PUSHING });
        await saveCreationState(state, Meta);

        state = await Organization._pushDataInParallel(state);
      }

      // Wait for data to be confirmed
      if (state.state === ORG_CREATION_STATES.DATA_PUSHING) {
        if (!USE_SIMULATOR) {
          logState(state, 'Waiting for data updates to confirm on blockchain');
          await datalayer.waitForAllTransactionsToConfirm();
        }
      }

      // PHASE 3: Finalize
      updateOrgLockStatus(lockToken, 'Finalizing organization record');
      state = updateState(state, { state: ORG_CREATION_STATES.FINALIZING });
      await saveCreationState(state, Meta);

      const orgUid = state.stores[STORE_TYPES.ORG_UID].id;
      const registryId = state.stores[STORE_TYPES.REGISTRY].id;
      const dataModelVersionStoreId = state.stores[STORE_TYPES.DATA_MODEL_VERSION].id;
      const fileStoreId = state.stores[STORE_TYPES.FILE_STORE].id;

      // Get the root hashes of the stores now that they're confirmed
      let orgHash = null;
      let dataModelVersionStoreHash = null;
      let registryHash = null;
      if (!USE_SIMULATOR) {
        try {
          const { confirmed, hash } = await getRoot(orgUid);
          if (confirmed && hash) {
            orgHash = hash;
            logState(state, `Org store hash: ${hash}`);
          }
        } catch (error) {
          logState(state, `Could not get org store hash: ${error.message}`, 'warn');
        }

        try {
          const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
          let hash = null;
          const rootResult = await getRoot(dataModelVersionStoreId);
          const { confirmed, hash: rootHash } = rootResult;
          // Chia get_root returns 0x00... for subscribed stores (invalid) or empty tree.
          // Fall back to get_local_root when get_root returns null hash (works for subscribed stores).
          if (confirmed && rootHash && rootHash !== nullHash && rootHash !== '0') {
            hash = rootHash;
          } else if (rootHash === nullHash || rootHash === '0' || !rootHash) {
            const localResult = await getLocalRoot(dataModelVersionStoreId);
            const localHash = localResult?.hash;
            if (localHash && localHash !== nullHash && localHash !== '0') {
              hash = localHash;
              logState(state, `Data model version store hash from get_local_root: ${hash}`);
            } else {
              logState(state, 'Data model version store root is empty/invalid (0x00...); not persisting hash', 'warn');
            }
          }
          if (hash) {
            dataModelVersionStoreHash = hash;
            logState(state, `Data model version store hash: ${hash}`);
          }
        } catch (error) {
          logState(state, `Could not get data model version store hash: ${error.message}`, 'warn');
        }

        try {
          const { confirmed, hash } = await getRoot(registryId);
          if (confirmed && hash) {
            registryHash = hash;
            logState(state, `Registry store hash: ${hash}`);
          }
        } catch (error) {
          logState(state, `Could not get registry store hash: ${error.message}`, 'warn');
        }
      }

      logState(state, 'Adding new home organization to CADT database');

      // Remove any existing org with this UID (in case of partial creation)
      await Organization.destroy({ where: { orgUid: orgUid } });

      await Promise.all([
        Organization.create({
          orgUid: orgUid,
          orgHash,
          dataModelVersionStoreId,
          dataModelVersionStoreHash,
          registryId: registryId,
          registryHash,
          isHome: true,
          subscribed: USE_SIMULATOR,
          fileStoreId,
          name: state.name,
          icon: state.icon,
        }),
        Organization.destroy({ where: { orgUid: 'PENDING' } }),
      ]);

      // Mark subscribed after confirmation
      if (!USE_SIMULATOR) {
        logState(state, 'Waiting for final confirmation');
        await new Promise((resolve, reject) => {
          datalayer.getStoreData(
            orgUid,
            async () => {
              logState(state, 'Organization confirmed, you are ready to go');
              await Organization.update(
                { subscribed: true },
                { where: { orgUid: orgUid } },
              );
              resolve();
            },
            (error) => reject(new Error(error)),
          );
        });
      } else {
        await Organization.update(
          { subscribed: true },
          { where: { orgUid: orgUid } },
        );
      }

      // Mark complete and clear state before mirror creation so org
      // creation success is not dependent on mirror operations.
      updateOrgLockStatus(lockToken, 'Organization creation complete');
      state = updateState(state, { state: ORG_CREATION_STATES.COMPLETE });
      await clearCreationState(Meta, 'v1');

      logState(state, `Organization creation complete. orgUid: ${orgUid}`);

      // Fire-and-forget: mirror only this org's stores rather than running
      // a full mirror check across all orgs. The periodic task handles the rest.
      mirrorOrgStores({
        orgUid,
        registryId,
        dataModelVersionStoreId,
        fileStoreId,
      }).catch((mirrorError) => {
        logState(state, `Mirror creation failed (will be retried by periodic task): ${mirrorError.message}`, 'warn');
      });

      return orgUid;
    } catch (error) {
      logState(state, `Error during creation: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Create all stores in parallel
   * @param {Object} state - Current state
   * @returns {Promise<Object>} Updated state
   * @private
   */
  static async _createStoresInParallel(state) {
    const storesToCreate = getStoresToCreate(state);

    if (storesToCreate.length === 0) {
      logState(state, 'All stores already created');
      return state;
    }

    logState(state, `Creating ${storesToCreate.length} stores in parallel`);

    // In simulator mode, only orgUid has a fixed ID (matching original V1 behavior)
    // Other stores get random UUIDs to avoid collision with V2 simulator stores
    if (USE_SIMULATOR) {
      for (const storeType of storesToCreate) {
        let storeId;
        if (storeType === STORE_TYPES.ORG_UID) {
          // Only orgUid is fixed in V1 simulator mode (original behavior)
          storeId = 'f1c54511-865e-4611-976c-7c3c1f704662';
        } else {
          storeId = await datalayer.createDataLayerStoreWithRetry();
        }
        state = markStoreCreated(state, storeType, storeId);
        state = markStoreConfirmed(state, storeType);
      }
      await saveCreationState(state, Meta);
      return state;
    }

    const maxRetries = 10;
    const retryDelayMs = 30000;

    // Persist each successful store creation immediately so the
    // /v1/organizations/creation-status endpoint reflects partial progress.
    // Without this, all 4 stores stay marked pending until the slowest
    // promise resolves, which makes the live-api "stuck state" detector
    // fire while the server is still actively making progress.
    const stateWriter = createIncrementalStateWriter(state, Meta);

    // Create all stores in parallel, each with independent retry logic.
    // The persist call is wrapped in its own try so that a transient
    // saveCreationState failure (DB busy, sequelize hiccup) does NOT
    // mask a successful on-chain store creation as a creation failure;
    // any missing persist will be reconciled in a final save below.
    const createPromises = storesToCreate.map(async (storeType) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logState(stateWriter.getCurrent(), `Creating ${storeType} store (attempt ${attempt}/${maxRetries})`);
          const storeId = await datalayer.createDataLayerStoreWithRetry();
          logState(stateWriter.getCurrent(), `Created ${storeType} store: ${storeId}`);
          try {
            await stateWriter.persistStoreCreated(storeType, storeId);
          } catch (persistError) {
            logState(
              stateWriter.getCurrent(),
              `Created ${storeType} store ${storeId} but failed to persist incremental progress: ` +
                `${persistError.message}. Store id retained in result; final save will reconcile.`,
              'warn',
            );
          }
          return { storeType, storeId, success: true };
        } catch (error) {
          if (isTransientWalletError(error) && attempt < maxRetries) {
            logState(
              stateWriter.getCurrent(),
              `Transient error creating ${storeType} store ` +
                `(attempt ${attempt}/${maxRetries}): ${error.message}. ` +
                `Retrying in ${retryDelayMs / 1000}s...`,
              'warn',
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
          logState(stateWriter.getCurrent(), `Failed to create ${storeType} store: ${error.message}`, 'error');
          return { storeType, storeId: null, success: false, error: error.message };
        }
      }
      return { storeType, storeId: null, success: false, error: 'Retry loop exhausted without result' };
    });

    const results = await Promise.all(createPromises);

    // Reconcile: pick up incremental updates that already landed, then
    // re-apply any successful storeIds whose persist failed mid-flight.
    // A single final saveCreationState makes sure the persisted view
    // matches in-memory state before returning.
    state = stateWriter.getCurrent();
    let reconcileNeeded = false;
    for (const result of results) {
      if (result.success && state.stores[result.storeType].id !== result.storeId) {
        state = markStoreCreated(state, result.storeType, result.storeId);
        reconcileNeeded = true;
      }
    }
    if (reconcileNeeded) {
      await saveCreationState(state, Meta);
    }

    // Check if all stores were created
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      const failedTypes = failed.map((f) => f.storeType).join(', ');
      throw new Error(`Failed to create stores: ${failedTypes}`);
    }

    return state;
  }

  /**
   * Wait for all stores to be confirmed on the blockchain
   * @param {Object} state - Current state
   * @returns {Promise<Object>} Updated state
   * @private
   */
  static async _waitForStoresConfirmation(state) {
    if (USE_SIMULATOR) {
      // In simulator mode, stores are immediately confirmed
      state = updateState(state, { state: ORG_CREATION_STATES.STORES_CONFIRMED });
      await saveCreationState(state, Meta);
      return state;
    }

    const storesAwaitingConfirmation = getStoresAwaitingConfirmation(state);
    if (storesAwaitingConfirmation.length === 0) {
      logState(state, 'All stores already confirmed');
      state = updateState(state, { state: ORG_CREATION_STATES.STORES_CONFIRMED });
      await saveCreationState(state, Meta);
      return state;
    }

    logState(state, `Waiting for ${storesAwaitingConfirmation.length} stores to confirm`);

    // Wait for all transactions to clear first
    await datalayer.waitForAllTransactionsToConfirm();

    // Then check each store's confirmation status in parallel
    const confirmPromises = storesAwaitingConfirmation.map(async (storeType) => {
      const storeId = state.stores[storeType].id;
      const startTime = Date.now();
      const timeout = ORG_CREATION_CONFIG.STORE_CONFIRMATION_TIMEOUT_MS;

      while (Date.now() - startTime < timeout) {
        try {
          const { confirmed } = await getRoot(storeId);
          if (confirmed) {
            logState(state, `Store ${storeType} (${storeId}) confirmed`);
            return { storeType, confirmed: true };
          }
        } catch (error) {
          logState(state, `Error checking ${storeType} confirmation: ${error.message}`, 'debug');
        }
        await new Promise((resolve) => setTimeout(resolve, ORG_CREATION_CONFIG.CONFIRMATION_POLL_INTERVAL_MS));
      }

      return { storeType, confirmed: false };
    });

    const results = await Promise.all(confirmPromises);

    // Update state with confirmation status
    for (const result of results) {
      if (result.confirmed) {
        state = markStoreConfirmed(state, result.storeType);
      }
    }
    await saveCreationState(state, Meta);

    // Check if all stores confirmed
    if (allStoresConfirmed(state)) {
      state = updateState(state, { state: ORG_CREATION_STATES.STORES_CONFIRMED });
      await saveCreationState(state, Meta);
      logState(state, 'All stores confirmed on blockchain');
    } else {
      const unconfirmed = results.filter((r) => !r.confirmed).map((r) => r.storeType);
      throw new Error(`Stores failed to confirm within timeout: ${unconfirmed.join(', ')}`);
    }

    return state;
  }

  /**
   * Lightweight health check for the direct-push path: detect rejected txs in the
   * DL wallet and auto-clear them before scheduling a background retry.
   * Non-blocking and best-effort -- failures are logged but don't propagate.
   * @private
   */
  static async _checkAndClearRejectedTxs(storeType, storeId) {
    try {
      const dlWalletId = await wallet.getDLWalletId();
      if (!dlWalletId) return;

      const health = await wallet.getTransactionHealth(dlWalletId);
      if (health.rejected.length > 0) {
        const txIds = health.rejected.map((tx) => tx.name);
        const context =
          `_pushDataInParallel failed for ${storeType} store ${storeId}, scheduling retry`;
        await wallet.clearRejectedTransactions(dlWalletId, txIds, context);
      }
    } catch (error) {
      logger.debug(`_checkAndClearRejectedTxs non-fatal error: ${error.message}`);
    }
  }

  /**
   * Wait for the wallet to be ready for a batch_update RPC. The Chia wallet
   * will reject batch_update with "Wallet needs to be fully synced" unless
   * the wallet is caught up to the tip AND the relevant wallet ids have no
   * unconfirmed transactions. We explicitly check all three signals here:
   *
   *   1. walletIsSynced()                  — wallet caught up to blockchain
   *   2. hasAnyUnconfirmedTransactions()   — standard + DL wallets settled
   *   3. waitForSpendableCoins(requiredCoins) — at least N coins available
   *
   * NOTE: waitForSpendableCoins alone is insufficient — it only polls
   * hasUnconfirmedTransactions('1') and coin records, not walletIsSynced().
   * On a node replaying blocks with no pending txs, it would return success
   * while the wallet still rejects transactions.
   *
   * Bounded by ORG_CREATION_CONFIG.DATA_PUSH_WALLET_SYNC_WAIT_MS. Throws on
   * timeout; the caller decides whether that's fatal (pre-flight) or should
   * fall through to the next retry attempt (per-push retry).
   *
   * No-ops in the simulator (no wallet).
   *
   * @param {number} requiredCoins - Minimum number of spendable coins needed.
   * @returns {Promise<void>}
   * @private
   */
  static async _waitForWalletReadyForPush(requiredCoins = 1) {
    if (USE_SIMULATOR) return;

    const totalTimeoutMs = ORG_CREATION_CONFIG.DATA_PUSH_WALLET_SYNC_WAIT_MS;
    const deadline = Date.now() + totalTimeoutMs;
    const pollIntervalMs = 5000;

    // Phase 1: wait for the wallet to report synced=true.
    while (Date.now() < deadline) {
      if (await wallet.walletIsSynced()) break;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (!(await wallet.walletIsSynced())) {
      throw new Error(
        `wallet did not reach fully-synced state within ${totalTimeoutMs / 1000}s`,
      );
    }

    // Phase 2: wait for all relevant wallets (standard + DL) to have no
    // unconfirmed transactions. This is what pushChangesWhenStoreIsAvailable
    // gates on, and it's stricter than waitForSpendableCoins's wallet_id=1
    // check.
    while (Date.now() < deadline) {
      if (!(await wallet.hasAnyUnconfirmedTransactions())) break;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (await wallet.hasAnyUnconfirmedTransactions()) {
      throw new Error(
        `unconfirmed transactions did not clear within ${totalTimeoutMs / 1000}s`,
      );
    }

    // Phase 3: verify at least requiredCoins spendable coins remain. We've
    // already waited for unconfirmed txs, so this usually returns quickly;
    // cap the remaining time so the overall helper respects totalTimeoutMs.
    const remainingMs = Math.max(10000, deadline - Date.now());
    await wallet.waitForSpendableCoins(requiredCoins, undefined, remainingMs);
  }

  /**
   * Push a single store's changelist with a bounded synchronous retry loop.
   *
   * Each attempt is preceded by a wallet-sync wait so that a transient desync
   * (e.g. wallet still processing store-creation confirmations) doesn't
   * immediately fail the push. Returns true on success, false after all
   * retries are exhausted. Throws on permanent errors (e.g. store not owned).
   *
   * Interaction with pushChangeListToDataLayer's internal retry loop:
   *  - pushChangeListToDataLayer has its own 5-attempt loop, but only retries
   *    on "Already have a pending root" and "Key already present" errors.
   *  - The target failure mode here ("Wallet needs to be fully synced")
   *    falls through to the final `return false` after a single attempt.
   *  - Because we've already waited for unconfirmed txs to clear in
   *    _waitForWalletReadyForPush, the "pending root" path is unlikely to
   *    compound here in practice.
   *
   * No-op in the simulator -- caller writes via the in-memory store instead.
   *
   * @param {string} storeType
   * @param {string} storeId
   * @param {Array} changeList
   * @param {Object} state
   * @returns {Promise<boolean>}
   * @private
   */
  static async _pushWithSyncRetry(storeType, storeId, changeList, state) {
    const maxAttempts = ORG_CREATION_CONFIG.MAX_DATA_PUSH_SYNC_RETRIES;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await Organization._waitForWalletReadyForPush(1);
      } catch (waitError) {
        const level = attempt === maxAttempts ? 'error' : 'warn';
        logState(
          state,
          `Wallet-readiness wait before ${storeType} push attempt ${attempt}/${maxAttempts} timed out: ${waitError.message}`,
          level,
        );
        if (attempt === maxAttempts) return false;
        continue;
      }

      const success = await pushChangeListToDataLayer(storeId, changeList, {
        skipTransactionWait: true,
      });
      if (success) {
        if (attempt > 1) {
          logState(
            state,
            `Push to ${storeType} store ${storeId} succeeded on attempt ${attempt}/${maxAttempts}`,
          );
        }
        return true;
      }

      if (attempt < maxAttempts) {
        logState(
          state,
          `Push to ${storeType} store ${storeId} returned false (attempt ${attempt}/${maxAttempts}); waiting for wallet readiness and retrying`,
          'warn',
        );
      } else {
        logState(
          state,
          `Push to ${storeType} store ${storeId} returned false after ${maxAttempts} sync-retry attempts; giving up on synchronous path`,
          'error',
        );
      }
    }
    return false;
  }

  /**
   * Push data to stores sequentially with a short delay between each.
   *
   * Before pushing, waits for the wallet to be synced with enough spendable
   * coins (pre-flight gate). After store creation the wallet is temporarily
   * desynced while processing confirmations; without this gate the first
   * batch_update RPC often fails with "Wallet needs to be fully synced",
   * which used to mark the entire creation as FAILED.
   *
   * Each push bypasses the legacy hasUnconfirmedTransactions gate in
   * pushChangesWhenStoreIsAvailable (with coin splitting we maintain multiple
   * coins specifically so back-to-back txs work), but is wrapped in a bounded
   * sync-retry loop (_pushWithSyncRetry) that re-checks wallet readiness
   * before each attempt. Only after those retries are exhausted do we fall
   * back to the fire-and-forget background retry + record the push as failed.
   *
   * Pushes are staggered by 2s so two batch_update RPCs don't hit the wallet
   * at the exact same instant (avoids a coin-selection race in the Chia wallet).
   *
   * @param {Object} state - Current state
   * @returns {Promise<Object>} Updated state
   * @private
   */
  static async _pushDataInParallel(state) {
    const storesNeedingData = getStoresNeedingData(state);

    if (storesNeedingData.length === 0) {
      logState(state, 'All store data already written');
      return state;
    }

    logState(state, `Pushing data to ${storesNeedingData.length} stores`);

    // Pre-flight: wait for the wallet to be synced with at least one spendable
    // coin before starting. This is a lightweight gate; the per-push retry
    // handles re-checks for subsequent pushes and the coin-management task
    // refills coins as they're consumed. Waiting for N coins here would be
    // stricter than necessary and could race coin splitting.
    if (!USE_SIMULATOR) {
      try {
        await Organization._waitForWalletReadyForPush(1);
        logState(state, 'Wallet is synced and ready for data push');
      } catch (waitError) {
        logState(
          state,
          `Wallet did not become ready for data push within ${ORG_CREATION_CONFIG.DATA_PUSH_WALLET_SYNC_WAIT_MS / 1000}s: ${waitError.message}`,
          'warn',
        );
        // Fall through: per-push _pushWithSyncRetry re-checks wallet
        // readiness before each attempt, so a slow-to-settle wallet still
        // has a chance to recover without aborting the whole creation.
      }
    }

    const orgUidStoreId = state.stores[STORE_TYPES.ORG_UID].id;
    const dataModelVersionStoreId = state.stores[STORE_TYPES.DATA_MODEL_VERSION].id;
    const registryStoreId = state.stores[STORE_TYPES.REGISTRY].id;
    const fileStoreId = state.stores[STORE_TYPES.FILE_STORE].id;

    // Build the list of pushes to make (storeType, storeId, changelist)
    const pushes = [];

    if (storesNeedingData.includes(STORE_TYPES.ORG_UID)) {
      const orgData = {
        registryId: dataModelVersionStoreId, // registryId key maps to the DATA MODEL VERSION store id
        fileStoreId,
        name: state.name,
        icon: state.icon,
      };
      pushes.push({
        storeType: STORE_TYPES.ORG_UID,
        storeId: orgUidStoreId,
        changeList: Object.keys(orgData).map((key) => ({
          action: 'insert',
          key: encodeHex(key),
          value: encodeHex(orgData[key]),
        })),
      });
    }

    if (storesNeedingData.includes(STORE_TYPES.DATA_MODEL_VERSION)) {
      const dmvData = { [state.dataVersion]: registryStoreId };
      pushes.push({
        storeType: STORE_TYPES.DATA_MODEL_VERSION,
        storeId: dataModelVersionStoreId,
        changeList: Object.keys(dmvData).map((key) => ({
          action: 'insert',
          key: encodeHex(key),
          value: encodeHex(dmvData[key]),
        })),
      });
    }

    const results = [];

    for (let i = 0; i < pushes.length; i++) {
      const { storeType, storeId, changeList } = pushes[i];

      // 2s delay between pushes so RPCs don't hit the wallet at the exact same instant
      if (i > 0 && !USE_SIMULATOR) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      try {
        logState(state, `Pushing data to ${storeType} store ${storeId}`);

        let success;
        if (USE_SIMULATOR) {
          // Simulator has no wallet/datalayer RPC — use the simulator's in-memory store
          const { pushChangeListToDataLayer: simPush } = await import('../../datalayer/simulator.js');
          await simPush(storeId, changeList);
          success = true;
        } else {
          // Sync-retry loop with a wallet-sync wait before each attempt. This
          // absorbs transient "Wallet needs to be fully synced" errors that
          // would otherwise fail the whole creation.
          success = await Organization._pushWithSyncRetry(
            storeType,
            storeId,
            changeList,
            state,
          );
        }

        if (success) {
          results.push({ storeType, success: true });
          state = markStoreDataWritten(state, storeType);
          await saveCreationState(state, Meta);
        } else {
          // Push was accepted by the function but returned false (RPC-level failure).
          // Check for rejected txs before scheduling background retry.
          logState(state, `Push to ${storeType} store ${storeId} failed, background retry scheduled`, 'error');
          await Organization._checkAndClearRejectedTxs(storeType, storeId);
          datalayer.pushDataLayerChangeList(storeId, changeList, () => {
            logState(state, `Background retry for ${storeType} store ${storeId} gave up`, 'error');
          });
          results.push({ storeType, success: false, error: 'batch_update RPC failed' });
        }
      } catch (error) {
        logState(state, `Push to ${storeType} store ${storeId} threw: ${error.message}`, 'error');
        if (!USE_SIMULATOR) {
          await Organization._checkAndClearRejectedTxs(storeType, storeId);
          datalayer.pushDataLayerChangeList(storeId, changeList, () => {
            logState(state, `Background retry for ${storeType} store ${storeId} gave up`, 'error');
          });
        }
        results.push({ storeType, success: false, error: error.message });
      }
    }

    // Check for failures
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      const failedTypes = failed.map((f) => `${f.storeType}: ${f.error}`).join(', ');
      throw new Error(`Failed to push data to stores: ${failedTypes}`);
    }

    return state;
  }

  /**
   * Get the current status of organization creation
   * @returns {Promise<Object>} Status summary object
   */
  static async getCreationStatus() {
    const state = await loadCreationState(Meta, 'v1');
    return getStatusSummary(state);
  }

  static async addMirror(storeId, url, force = false) {
    await datalayer.addMirror(storeId, url, force);
  }

  /**
   * subscribes to an organization and reconciles the organization table store records against datalayer's store records
   *
   * if validating a home org, asserts all stores related to organization are owned.
   *
   * NOTE: assertions should be used at the controller level, but given that the data model version store id
   * and registry store id need to be derived as part of this process, this function asserts their ownership status
   * @param organization the organization table record of the organization to reconcile
   * @returns {Promise<void>}
   * @throws Error on failure. call in a try block
   */
  static async reconcileOrganization(organization, { skipOnUnsynced = false } = {}) {
    if (USE_SIMULATOR) {
      return;
    }

    if (!organization) {
      throw new Error('organization to reconcile must not be nil');
    }

    if (organization.orgUid === 'PENDING') {
      logger.info(
        'skipping organization reconciliation for pending home organization',
      );
      return;
    }

    const orgReduced = organization;
    delete orgReduced.icon;
    delete orgReduced.metadata;
    logger.debug(
      `reconciling organization ${orgReduced.orgUid} storeIds against datalayer. organization data from db (icon and metadata removed for compactness): ${JSON.stringify(orgReduced)}`,
    );
    const { name, orgUid, registryId, dataModelVersionStoreId, isHome } =
      organization;

    if (!orgUid) {
      throw new Error(
        `organization record is missing orgUid. the organization is unusable in this state. organization record: ${JSON.stringify(organization)}`,
      );
    }

    if (isHome) {
      try {
        await assertStoreIsOwned(orgUid);
      } catch {
        throw new Error(
          `orgUid store ${orgUid} is not owned by this chia wallet. CADT cannot correct this issue. please contact your administrator`,
        );
      }
    }

    // Skip-or-throw helper: for transient "not ready" conditions, background
    // tasks want a silent skip (skipOnUnsynced=true), request-paths want a hard
    // failure (skipOnUnsynced=false, the default) so their downstream destructive
    // writes (e.g. POST /organizations/resync resetting registryHash and
    // destroying all data-model rows) don't run against stale state.
    const skipOrThrow = (message) => {
      if (skipOnUnsynced) {
        logger.info(`[v1]: reconcileOrganization: ${message}. Will retry on next task run.`);
        return;
      }
      throw new Error(`reconcileOrganization: ${message}`);
    };

    // Subscribe to org store first so it begins syncing, then check sync status
    // before entering the blocking subscription flow.  If either the org store or
    // its derived singleton store is not yet synced, return early so the periodic
    // task retries on the next run rather than waiting up to 10 minutes.
    //
    // subscribeToStoreOnDataLayer returns falsy on the common failure paths
    // (no storeId, getSubscriptions RPC failure) and also throws on unexpected
    // errors, so guard on both.  Without the falsy-return check, the dominant
    // datalayer-unreachable failure would slip past the try/catch and the
    // subsequent "not yet synced" skip log would be misleading.
    let subscribeErr;
    try {
      const subscribed = await datalayer.subscribeToStoreOnDataLayer(orgUid);
      if (!subscribed) {
        subscribeErr = `could not subscribe to org store ${orgUid}`;
      }
    } catch (error) {
      subscribeErr = `could not subscribe to org store ${orgUid}: ${error.message}`;
    }
    if (subscribeErr) {
      skipOrThrow(subscribeErr);
      return;
    }

    let orgStatusErr;
    try {
      const orgSyncStatus = await getDataLayerStoreSyncStatus(orgUid);
      if (!isDlStoreSynced(orgSyncStatus?.sync_status)) {
        orgStatusErr = `org store ${orgUid} not yet synced`;
      }
    } catch (error) {
      orgStatusErr = `could not check sync status for org store ${orgUid}: ${error.message}`;
    }
    if (orgStatusErr) {
      skipOrThrow(orgStatusErr);
      return;
    }

    // Check the singleton (data model version) store before the blocking fetch inside
    // subscribeToOrganization so that an unsynced singleton doesn't stall the background task.
    if (dataModelVersionStoreId) {
      let singletonStatusErr;
      try {
        const singletonSyncStatus = await getDataLayerStoreSyncStatus(dataModelVersionStoreId);
        if (!isDlStoreSynced(singletonSyncStatus?.sync_status)) {
          singletonStatusErr = `singleton store ${dataModelVersionStoreId} for org ${orgUid} not yet synced`;
        }
      } catch (error) {
        singletonStatusErr = `could not check sync status for singleton store ${dataModelVersionStoreId}: ${error.message}`;
      }
      if (singletonStatusErr) {
        skipOrThrow(singletonStatusErr);
        return;
      }
    }

    logger.debug(
      `running the organization model subscription process on ${orgUid}`,
    );

    const organizationStoreIdsFromDatalayer =
      await Organization.subscribeToOrganization(orgUid).catch((error) => {
        logger.error(
          `failed to subscribe to, or validate subscribed store data for organization ${orgUid}. Error: ${error.message}`,
        );
        throw new Error(
          `failed to subscribe to, or validate subscribed store data for organization ${orgUid}`,
        );
      });

    const {
      dataModelVersionStoreId: datalayerDataModelVersionStoreId,
      registryStoreId: datalayerRegistryStoreId,
    } = organizationStoreIdsFromDatalayer;
    if (isHome) {
      try {
        await assertStoreIsOwned(datalayerDataModelVersionStoreId);
      } catch {
        throw new Error(
          `datamodel version store ${datalayerDataModelVersionStoreId} is not owned by this chia wallet. CADT cannot correct this issue. please contact your administrator`,
        );
      }

      try {
        await assertStoreIsOwned(datalayerRegistryStoreId);
      } catch {
        throw new Error(
          `registry store ${datalayerRegistryStoreId} is not owned by this chia wallet. CADT cannot correct this issue. please contact your administrator`,
        );
      }
    }

    const updatedOrganizationData = {};

    if (dataModelVersionStoreId !== datalayerDataModelVersionStoreId) {
      const message =
        `data layer reports that the data model version store id for ${name} (orgUid ${orgUid}) is ${datalayerDataModelVersionStoreId}, ` +
        `but the organization table record shows the store id as ${dataModelVersionStoreId}. correcting organization table record`;
      logger.warn(message);
      updatedOrganizationData.dataModelVersionStoreId =
        datalayerDataModelVersionStoreId;
    }

    if (registryId !== datalayerRegistryStoreId) {
      const message =
        `data layer reports that the registry store id for ${name} (orgUid ${orgUid}) ` +
        `is ${organizationStoreIdsFromDatalayer.dataModelVersionStoreId}, but found ${dataModelVersionStoreId} in ` +
        `organizaation table record. correcting organization table record`;
      logger.warn(message);
      updatedOrganizationData.dataModelVersionStoreId =
        datalayerDataModelVersionStoreId;
    }

    // note that we only update the data model version store hash here because the other two store hashes are updated elsewhere
    const dataModelVersionStoreSyncStatus = await getDataLayerStoreSyncStatus(
      datalayerDataModelVersionStoreId,
    );

    if (isDlStoreSynced(dataModelVersionStoreSyncStatus?.sync_status)) {
      const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      let hash = null;
      const rootResult = await getRoot(datalayerDataModelVersionStoreId);
      const { confirmed, hash: rootHash } = rootResult;
      if (confirmed && rootHash && rootHash !== nullHash && rootHash !== '0') {
        hash = rootHash;
      } else if (rootHash === nullHash || rootHash === '0' || !rootHash) {
        const localResult = await getLocalRoot(datalayerDataModelVersionStoreId);
        const localHash = localResult?.hash;
        if (localHash && localHash !== nullHash && localHash !== '0') {
          hash = localHash;
        }
      }
      if (hash && hash !== organization.dataModelVersionStoreHash) {
        logger.info(
          `data model version store ${datalayerDataModelVersionStoreId} root hash needs to be updated ` +
            `from ${organization.dataModelVersionStoreHash} to ${hash}`,
        );
        updatedOrganizationData.dataModelVersionStoreHash = hash;
      } else if (!confirmed && !hash) {
        logger.warn(
          `data model version store ${datalayerDataModelVersionStoreId} has not been confirmed yet. cannot validate or update hash.`,
        );
      }
    }

    if (!organization.subscribed) {
      updatedOrganizationData.subscribed = true;
    }

    if (!_.isEmpty(updatedOrganizationData)) {
      logger.info(
        `reconcile organization task is updating organization ${organization.orgUid} with the following data ${JSON.stringify(updatedOrganizationData)}`,
      );
      try {
        await Organization.update(updatedOrganizationData, {
          where: { orgUid },
        });
      } catch {
        throw new Error(
          'failed to write updated organization data to organization table',
        );
      }
    } else {
      logger.info(
        `reconcile organization task found organization ${organization.orgUid} required no updates or corrections`,
      );
    }
  }

  /**
   * subscribes to and imports an organization.
   *
   * if importing as home, asserts all stores related to organization are owned.
   *
   * NOTE: assertions should be used at the controller level, but given that the data model version store id
   * and registry store id need to be derived as part of this process, this function asserts their ownership status
   * @param orgUid the orgUid of the organization to import
   * @param isHome import the org as a home org
   * @returns {Promise<void>}
   */
  static async importOrganization(orgUid, isHome = false) {
    // Subscribe to the org store first, then check sync status.
    // This ensures new org stores get subscribed on the first pass so they can
    // begin syncing, and subsequent runs will find them synced and proceed.
    if (!USE_SIMULATOR) {
      // subscribeToStoreOnDataLayer returns falsy on the common failure paths
      // (no storeId, getSubscriptions RPC failure) and also throws on
      // unexpected errors, so guard on both.  Without the falsy-return check,
      // the dominant datalayer-unreachable failure slips past the try/catch
      // and the subsequent "not yet synced" skip log is misleading.  Same
      // pattern as Governance.sync and reconcileOrganization.
      try {
        const subscribed = await datalayer.subscribeToStoreOnDataLayer(orgUid);
        if (!subscribed) {
          logger.warn(
            `[v1]: Could not subscribe to org store ${orgUid}. Skipping import, will retry on next task run.`,
          );
          return;
        }
      } catch (error) {
        logger.warn(
          `[v1]: Could not subscribe to org store ${orgUid}: ${error.message}. Skipping import, will retry on next task run.`,
        );
        return;
      }

      // Check if store is synced BEFORE acquiring mutex to avoid blocking other operations
      // If store is not synced, skip import - it will be retried on next task run
      try {
        const syncStatus = await datalayer.getDataLayerStoreSyncStatus(orgUid);
        if (!isDlStoreSynced(syncStatus?.sync_status)) {
          logger.info(
            `[v1]: Skipping import of organization ${orgUid} - store not yet synced. Will retry on next task run.`,
          );
          return;
        }
      } catch (error) {
        logger.warn(
          `[v1]: Could not check sync status for ${orgUid}, skipping import: ${error.message}`,
        );
        return;
      }

      // Read the org store to discover the data-model-version (singleton) store
      // id, subscribe to it, and pre-check its sync status.  Without this,
      // subscribeToOrganization would enter a 10-minute blocking wait loop on
      // the singleton store during first-time imports.  Skip this import now
      // and let the next task run retry once the singleton has synced.
      let singletonStoreId;
      try {
        const orgStoreData = await datalayer.getSubscribedStoreData(
          orgUid,
          undefined,
          false,
        );
        singletonStoreId = orgStoreData?.registryId;
      } catch (error) {
        logger.warn(
          `[v1]: Could not read org store ${orgUid} to discover singleton id, skipping import: ${error.message}`,
        );
        return;
      }

      if (!singletonStoreId) {
        logger.warn(
          `[v1]: Org store ${orgUid} does not contain a data-model-version store id, skipping import.`,
        );
        return;
      }

      try {
        const singletonSubscribed = await datalayer.subscribeToStoreOnDataLayer(
          singletonStoreId,
        );
        if (!singletonSubscribed) {
          logger.warn(
            `[v1]: Could not subscribe to singleton store ${singletonStoreId} for org ${orgUid}. Skipping import, will retry on next task run.`,
          );
          return;
        }
      } catch (error) {
        logger.warn(
          `[v1]: Could not subscribe to singleton store ${singletonStoreId} for org ${orgUid}: ${error.message}. Skipping import, will retry on next task run.`,
        );
        return;
      }

      try {
        const singletonSyncStatus = await datalayer.getDataLayerStoreSyncStatus(
          singletonStoreId,
        );
        if (!isDlStoreSynced(singletonSyncStatus?.sync_status)) {
          logger.info(
            `[v1]: Skipping import of organization ${orgUid} - singleton store ${singletonStoreId} not yet synced. Will retry on next task run.`,
          );
          return;
        }
      } catch (error) {
        logger.warn(
          `[v1]: Could not check sync status for singleton store ${singletonStoreId}, skipping import: ${error.message}`,
        );
        return;
      }
    }

    logger.verbose('[v1]: acquiring mutex to import organization');
    const releaseMutex = await addOrDeleteOrganizationRecordMutex.acquire();

    // any error caught is re-thrown. this outer try is here because we need to release a mutex
    try {
      if (isHome) {
        try {
          await assertStoreIsOwned(orgUid);
        } catch {
          throw new Error(
            `orgUid store ${orgUid} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
          );
        }
      }

      await Meta.removeUserDeletedOrgUid(orgUid);

      logger.info(`[v1]: importing organization ${orgUid} ${isHome && 'as home'}`);
      logger.debug(
        `running the organization model subscription process on ${orgUid}`,
      );

      let storeIds = null;
      try {
        storeIds = await Organization.subscribeToOrganization(orgUid);
      } catch (error) {
        logger.error(
          `failure validating or adding subscriptions for org import. cannot import. Error: ${error.message}`,
        );
        throw new Error(
          `failed to subscribe to, or validate subscribed store data for, organization ${orgUid}`,
        );
      }

      if (isHome) {
        try {
          await assertStoreIsOwned(storeIds.dataModelVersionStoreId);
        } catch {
          throw new Error(
            `datamodel version store ${storeIds.dataModelVersionStoreId} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
          );
        }

        try {
          await assertStoreIsOwned(storeIds.registryStoreId);
        } catch {
          throw new Error(
            `registry store ${storeIds.registryStoreId} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
          );
        }
      }

      const orgData = await datalayer.getCurrentStoreData(storeIds.orgUid);
      if (!orgData) {
        throw new Error(`failed to get organization data for ${orgUid}`);
      }

      const dataModelInfo = await datalayer.getCurrentStoreData(
        storeIds.dataModelVersionStoreId,
      );
      if (!dataModelInfo) {
        throw new Error(
          `failed to determine datamodel version for organization ${orgUid}`,
        );
      }

      const instanceDataModelVersion = 'v1';
      if (!dataModelInfo[instanceDataModelVersion]) {
        throw new Error(
          `this cadt instance is using datamodel version ${instanceDataModelVersion}. organization ${orgUid} does not have data for this datamodel. cannot import`,
        );
      }

      const organizationData = {
        orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registryId: storeIds.registryStoreId,
        dataModelVersionStoreId: storeIds.dataModelVersionStoreId,
        fileStoreId: orgData?.fileStoreId,
        subscribed: true,
        isHome,
      };
      logger.info(
        `adding and organization with the following info ${organizationData}`,
      );

      await Organization.create(organizationData);
    } catch (error) {
      throw new Error(error.message);
    } finally {
      releaseMutex();
    }
  }

  /**
   * Subscribes to all 3 required stores for a CADT organization and returns the store id's from datalayer.
   *
   * This function CAN BE RUN even if the organization is fully subscribed.
   *
   * CADT organization stores:
   * <ul>
   *   <li><strong>Organization Store</strong> (identified by `orgUid`):
   *     <ul>
   *       <li>Tracks the organization identifier (`orgUid`).</li>
   *       <li>Contains metadata and the identifier for the associated data model version store.</li>
   *     </ul>
   *   </li>
   *   <li><strong>Registry Data Model Version Store</strong>:
   *     <ul>
   *       <li>Identified using the `registryId` key from the organization store data.</li>
   *       <li>Tracks the registry store identifiers for different data model versions (e.g., `v1`).</li>
   *       <li>Note: Despite the misleading key name, this is NOT the registry store ID itself.</li>
   *     </ul>
   *   </li>
   *   <li><strong>Registry Store</strong>:
   *     <ul>
   *       <li>Contains the organization’s climate data for a specific data model version.</li>
   *       <li>Located at the version key (e.g., `v1`) in the data model version store.</li>
   *     </ul>
   *   </li>
   * </ul>
   *
   * @param {string} orgUid - The unique identifier of the organization to subscribe to.
   * @returns {Promise<{orgUid: string, dataModelVersionStoreId: string, registryStoreId: string}>}
   *          Resolves to an object containing:
   *          - `orgUid`: The unique identifier of the organization.
   *          - `dataModelVersionStoreId`: The identifier of the data model version store.
   *          - `registryStoreId`: The identifier of the registry store.
   */
  static async subscribeToOrganization(orgUid) {
    if (orgUid === 'PENDING') {
      logger.info('[v1]: cannot subscribe to a home organization while its pending.');
    }

    logger.debug(
      `running the organization subscription process on organization ${orgUid})`,
    );

    // we'll give datalayer 10 minutes to get data where it needs to be and complete this process
    const timeout = Date.now() + 600000;
    const reachedTimeout = () => {
      return Date.now() > timeout;
    };
    const onTimeout = (error) => {
      const message = `reached timeout before subscribing to all required stores. Failure at time out: ${error.message}`;
      logger.error(message);
      throw new Error(message);
    };

    logger.debug(
      `determining datamodel version singleton id for org ${orgUid}`,
    );
    let orgStoreData = null;
    while (!orgStoreData) {
      try {
        orgStoreData = await datalayer.getSubscribedStoreData(
          orgUid,
          undefined,
          true,
        );
      } catch (error) {
        if (reachedTimeout()) {
          onTimeout(error);
        }
        logger.debug(`[v1]: ${error.message}. RETRYING`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    // here registryId is actually the data model version store that points to the registry store
    const dataModelVersionStoreId = orgStoreData.registryId;
    if (!dataModelVersionStoreId) {
      throw new Error(
        `failed to get registry datamodel version singleton id from orgUid store ${orgUid}. rpc function returned: ${orgStoreData}`,
      );
    }
    logger.debug(
      `the registry datamodel version pointer singleton id for organization ${orgUid} is ${dataModelVersionStoreId}`,
    );

    logger.debug(`[v1]: determining registry store singleton id for org ${orgUid}`);
    let dataModelVersionStoreData = null;
    while (!dataModelVersionStoreData) {
      try {
        dataModelVersionStoreData = await datalayer.getSubscribedStoreData(
          dataModelVersionStoreId,
          undefined,
          true,
        );
      } catch (error) {
        if (reachedTimeout()) {
          onTimeout(error);
        }
        logger.debug(`[v1]: ${error.message}. RETRYING`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    // here v1 is actually the registry store id
    const registryStoreId = dataModelVersionStoreData?.v1;
    if (!registryStoreId) {
      throw new Error(
        `failed to get registry singleton id from datamodel version singleton store ${dataModelVersionStoreId}. rpc function returned: ${dataModelVersionStoreData}`,
      );
    }
    logger.debug(
      `the registry singleton id for organization ${orgUid} is ${registryStoreId}`,
    );

    logger.debug(`[v1]: checking registry store singleton for org ${orgUid}`);
    const subscribedToRegistryStore =
      await datalayer.subscribeToStoreOnDataLayer(registryStoreId);
    if (!subscribedToRegistryStore) {
      throw new Error(
        `failed to subscribe to or validate subscription for registry store ${registryStoreId}`,
      );
    }

    if (AUTO_SUBSCRIBE_FILESTORE) {
      logger.info(`[v1]: subscribing to file store for organization ${orgUid}`);
      try {
        await FileStore.subscribeToFileStore(orgUid);
      } catch (error) {
        logger.warn(
          `failed to subscribe to file store. Error: ${error.message}`,
        );
      }
    }

    const organization = await Organization.findOne({
      where: { orgUid },
      raw: true,
    });
    if (organization) {
      logger.info(`[v1]: marking existing organization record as subscribed`);
      await Organization.update({ subscribed: true }, { where: { orgUid } });
    }

    return {
      orgUid,
      dataModelVersionStoreId,
      registryStoreId,
    };
  }

  /**
   *
   * @param {Organization | Object} organizationStores
   * @param {string} organizationStores.orgUid
   * @param {string} organizationStores.dataModelVersionStoreId
   * @param {string} organizationStores.registryId
   * @returns {Promise<void>}
   */
  static async unsubscribeFromOrganizationStores(organizationStores) {
    const { storeIds: subscriptionIds, success } = await getSubscriptions();
    if (!success) {
      throw new Error('failed to get subscriptions from datalayer');
    }

    const storesToUnsubscribe =
      Organization.getOrganizationStoreIds(organizationStores);
    const failedUnsubscribes = [];

    Organization.assertOrganizationStoreIdsPresent(organizationStores);

    for (const storeId of storesToUnsubscribe) {
      if (subscriptionIds.includes(storeId)) {
        logger.verbose(
          `unsubscribing from store ${storeId} associated with organization ${organizationStores.orgUid}`,
        );
        try {
          await datalayer.unsubscribeFromDataLayerStoreWithRetry(storeId);
        } catch (error) {
          logger.error(
            `unsubscribeFromOrganization() encountered an error: ${error.message}`,
          );
          failedUnsubscribes.push(storeId);
        }
      }
    }

    if (failedUnsubscribes.length) {
      const message = `failed to unsubscribe from the following organization stores: ${failedUnsubscribes}`;
      logger.error(message);
      throw new Error(message);
    }

    const orgExistsInDb = await Organization.findOne({
      where: { orgUid: organizationStores.orgUid },
      raw: true,
    });

    if (orgExistsInDb) {
      await Organization.update(
        { subscribed: false },
        { where: { orgUid: organizationStores.orgUid } },
      );
    }
  }

  static getOrganizationStoreIds(organizationStores) {
    return [
      organizationStores.orgUid,
      organizationStores.dataModelVersionStoreId,
      organizationStores.registryId,
    ];
  }

  static assertOrganizationStoreIdsPresent(organizationStores) {
    Organization.getOrganizationStoreIds(organizationStores).forEach((storeId) => {
      if (!storeId) {
        throw new Error(
          `organization stores cannot be nil. found nil store id associated with organization ${organizationStores.orgUid}`,
        );
      }
    });
  }

  static async areOrganizationStoresUnsubscribed(organizationStores) {
    const { storeIds: subscriptionIds, success } = await getSubscriptions();
    if (!success) {
      throw new Error('failed to get subscriptions from datalayer');
    }

    Organization.assertOrganizationStoreIdsPresent(organizationStores);
    const subscribedStoreIds = new Set(subscriptionIds);
    return Organization.getOrganizationStoreIds(organizationStores)
      .every((storeId) => !subscribedStoreIds.has(storeId));
  }

  /**
   * removes all records of an organization from all models with an `orgUid` column
   * @param orgUid
   * @param {object} [options]
   * @param {boolean} [options.skipStagingTruncate=false] - When true, the global
   *   staging table is left untouched. Staging holds only the home org's pending
   *   (uncommitted) changes and has no orgUid column, so background callers that
   *   remove a remote org (e.g. orglist subscription reconcile) must pass `true`
   *   to avoid discarding the operator's own staged work.
   * @param {boolean} [options.recordUserDeleted=true] - When true, the org is
   *   recorded in the meta user-deleted list so default-org sync will not
   *   re-import it. Background orglist reconcile passes `false`: an org removed
   *   because it left the governance orgList is not a user deletion.
   * @param {boolean} [options.useCommittedBatches=false] - When true, each
   *   purge batch is committed independently so background purges release SQLite
   *   write locks between batches. Manual API deletes keep one transaction by
   *   default.
   * @returns {Promise<number>} total number of local database rows deleted
   */
  static async deleteAllOrganizationData(
    orgUid,
    {
      skipStagingTruncate = false,
      recordUserDeleted = true,
      useCommittedBatches = false,
    } = {},
  ) {
    const batchSize = resolveDeleteBatchSize(
      getConfig().APP.ORG_PURGE_DELETE_BATCH_SIZE,
    );
    logger.verbose('[v1]: acquiring add/delete org mutex to delete organization');
    const releaseAddDeleteMutex =
      await addOrDeleteOrganizationRecordMutex.acquire();

    logger.verbose(
      'acquiring processingSyncRegistriesTransaction mutex to delete organization',
    );
    const releaseAuditTransactionMutex =
      await processingSyncRegistriesTransactionMutex.acquire();

    let mutexesReleased = false;
    const releaseMutexes = () => {
      if (!mutexesReleased) {
        mutexesReleased = true;
        releaseAuditTransactionMutex();
        releaseAddDeleteMutex();
      }
    };

    let sharedTransaction;

    const runDeleteBatch = async (operation) => {
      if (sharedTransaction) {
        return await operation(sharedTransaction);
      }

      let transaction;
      try {
        transaction = await sequelize.transaction();
        const result = await operation(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        try {
          if (transaction) {
            await transaction.rollback();
          }
        } catch (rollbackError) {
          logger.error(
            `[v1]: rollback failed while deleting organization ${orgUid}: ${rollbackError.message}`,
          );
        }
        throw error;
      }
    };

    let deletedRowCount = 0;
    try {
      if (!useCommittedBatches) {
        sharedTransaction = await sequelize.transaction();
      }

      for (const modelKey of Object.keys(ModelKeys)) {
        deletedRowCount += await destroyByPrimaryKeyBatches(ModelKeys[modelKey], {
          where: { orgUid },
          batchSize,
          transactionRunner: runDeleteBatch,
        });
      }

      if (!skipStagingTruncate) {
        await runDeleteBatch((transaction) =>
          Staging.truncate({ transaction }),
        );
      }
      deletedRowCount += await destroyByPrimaryKeyBatches(FileStore, {
        where: { orgUid },
        batchSize,
        transactionRunner: runDeleteBatch,
      });
      deletedRowCount += await destroyByPrimaryKeyBatches(Audit, {
        where: { orgUid },
        batchSize,
        transactionRunner: runDeleteBatch,
        findOptions: { hooks: false },
      });
      deletedRowCount += await destroyByPrimaryKeyBatches(Organization, {
        where: { orgUid },
        batchSize,
        transactionRunner: runDeleteBatch,
      });

      if (sharedTransaction) {
        await sharedTransaction.commit();
        sharedTransaction = null;
      }
    } catch (error) {
      try {
        if (sharedTransaction) {
          await sharedTransaction.rollback();
          sharedTransaction = null;
        }
      } catch (rollbackError) {
        logger.error(
          `[v1]: rollback failed while deleting organization ${orgUid}: ${rollbackError.message}`,
        );
      }
      logger.error(
        `[v1]: failed to delete all db records for organization ${orgUid}. Error: ${error.message}`,
      );
      releaseMutexes();
      throw new Error(
        useCommittedBatches
          ? `an error occurred while deleting records corresponding to organization ${orgUid}. some committed batches may be retried on the next run`
          : `an error occurred while deleting records corresponding to organization ${orgUid}`,
      );
    }

    // Record the deletion after a successful commit, while still holding the
    // mutexes so the default-org sync cannot re-import the org between the
    // commit and the meta write. Keep the meta write out of the transaction
    // try so a post-commit failure never triggers a rollback of an already
    // committed transaction.
    try {
      if (recordUserDeleted) {
        await Meta.addUserDeletedOrgUid(orgUid);
      }
    } finally {
      releaseMutexes();
    }

    return deletedRowCount;
  }

  /**
   * Synchronizes metadata for all subscribed organizations.
   *
   * Skips orgs whose orgUid store is not yet fully synced on the datalayer.
   * Without the pre-check, `datalayer.getStoreIfUpdated` can descend into
   * `syncService.getStoreData`'s retry loop (20 × 10 s) for any org whose
   * root hash has changed but data has not yet propagated, which serializes
   * into minutes-per-org of scheduler blocking when multiple orgs update.
   */
  static async syncOrganizationMeta() {
    try {
      const allSubscribedOrganizations = await Organization.findAll({
        where: { subscribed: true },
        raw: true,
      });

      for (const organization of allSubscribedOrganizations) {
        if (!USE_SIMULATOR) {
          // Subscribe-first, then check sync status.  Without subscribing,
          // getDataLayerStoreSyncStatus errors/returns falsy for any store
          // the DL node has no record of (e.g. after a datalayer DB reset),
          // we skip, and no subsequent run ever subscribes — a permanent
          // skip loop.  subscribeToStoreOnDataLayer returns falsy on the
          // common failure paths (datalayer unreachable, getSubscriptions
          // RPC failure) and also throws on unexpected errors, so guard on
          // both.  Same pattern as Governance.sync and reconcileOrganization.
          try {
            const subscribed = await datalayer.subscribeToStoreOnDataLayer(
              organization.orgUid,
            );
            if (!subscribed) {
              logger.warn(
                `[v1]: syncOrganizationMeta: could not subscribe to org store ${organization.orgUid}. Skipping this run.`,
              );
              continue;
            }
          } catch (error) {
            logger.warn(
              `[v1]: syncOrganizationMeta: could not subscribe to org store ${organization.orgUid}: ${error.message}. Skipping this run.`,
            );
            continue;
          }

          try {
            const syncStatus = await getDataLayerStoreSyncStatus(organization.orgUid);
            if (!isDlStoreSynced(syncStatus?.sync_status)) {
              logger.info(
                `[v1]: syncOrganizationMeta: org store ${organization.orgUid} not yet synced, skipping this run.`,
              );
              continue;
            }
          } catch (error) {
            logger.warn(
              `[v1]: syncOrganizationMeta: could not check sync status for org store ${organization.orgUid}, skipping this run: ${error.message}`,
            );
            continue;
          }
        }

        const processData = (data, keyFilter) =>
          data
            .filter(({ key }) => keyFilter(key))
            .reduce(
              (update, { key, value }) => ({ ...update, [key]: value }),
              {},
            );

        const onFail = async (message) => {
          logger.info(`[v1]: Unable to sync metadata from ${organization.orgUid}`);
          logger.error(`[v1]: ORGANIZATION DATA SYNC ERROR: ${message}`);
          await Organization.update(
            { orgHash: '0' },
            { where: { orgUid: organization.orgUid } },
          );
        };

        const onResult = async (updateHash, data) => {
          try {
            const updateData = processData(
              data,
              (key) => !key.includes('meta_'),
            );
            const metadata = processData(data, (key) => key.includes('meta_'));

            await Organization.update(
              {
                ..._.omit(updateData, [
                  'registryId',
                  'dataModelVersionStoreId',
                  'isHome',
                ]),
                prefix: updateData.prefix || '0',
                metadata: JSON.stringify(metadata),
              },
              { where: { orgUid: organization.orgUid } },
            );

            logger.debug(
              `Updating orgUid ${organization.orgUid} with hash ${updateHash}`,
            );
            await Organization.update(
              { orgHash: updateHash },
              { where: { orgUid: organization.orgUid } },
            );
          } catch (error) {
            logger.info(error.message);
            onFail(error.message);
          }
        };

        await datalayer.getStoreIfUpdated(
          organization.orgUid,
          organization.orgHash,
          onResult,
          onFail,
        );
      }
    } catch (error) {
      logger.error(error.message);
    }
  }

  static async editOrgMeta({ name, icon }) {
    const myOrganization = await Organization.getHomeOrg();

    const payload = {};

    if (name) {
      payload.name = name;
    }

    if (icon) {
      payload.icon = icon;
    }

    await datalayer.upsertDataLayer(myOrganization.orgUid, payload);
  }

  static async addMetadata(payload) {
    const myOrganization = await Organization.getHomeOrg();

    // Prefix keys with "meta_"
    const metadata = _.mapKeys(payload, (_value, key) => `meta_${key}`);

    await datalayer.upsertDataLayer(myOrganization.orgUid, metadata);
  }

  static async removeMirror(storeId, coinId) {
    datalayer.removeMirror(storeId, coinId);
  }
}

Organization.init(ModelTypes, {
  sequelize,
  modelName: 'organization',
  timestamps: true,
});

export { Organization };
