'use strict';

import { Model } from 'sequelize';
import _ from 'lodash';

import { sequelize } from '../../database';

import datalayer from '../../datalayer';
import wallet from '../../datalayer/wallet.js';
import { logger } from '../../config/logger';
import { Audit, FileStore, Meta, ModelKeys, Staging } from '../';
import { getConfig } from '../../utils/config-loader';
const { USE_SIMULATOR, AUTO_SUBSCRIBE_FILESTORE } = getConfig().APP;

import ModelTypes from './organizations.modeltypes.cjs';
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
} from '../../utils/organization-creation-state.js';
import { runMirrorCheck } from '../../tasks/mirror-check.js';
import { updateOrgLockStatus } from '../../utils/org-operation-lock.js';

const { isTransientWalletError } = wallet;

class Organization extends Model {
  static async getHomeOrg(includeAddress = true) {
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
      myOrganization.xchAddress = await datalayer.getPublicAddress();
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
        organizations[i].dataValues.xchAddress =
          await datalayer.getPublicAddress();
        organizations[i].dataValues.balance =
          await datalayer.getWalletBalance();

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
        if (!coinCheck.success) {
          throw new Error(
            `Cannot create organization: ${coinCheck.error || 'Insufficient spendable coins'}. ` +
            'Please ensure wallet has sufficient balance, coin management has split coins, and no pending transactions.',
          );
        }
        logger.info(`[v1]: Proceeding with org creation, ${coinCheck.coinCount} coins available`);
      }

      // Execute the creation process
      return await Organization._executeOrganizationCreation(state, lockToken);
    } catch (error) {
      logger.error(
        `[v1]: create organization process failed. Error: ${error.message}`,
      );
      await Organization.destroy({ where: { orgUid: 'PENDING' } });
      // Mark state as FAILED so the 409 guard in the controller doesn't
      // permanently block new creation attempts within the same session.
      // The startup recovery task only runs once, so mid-session failures
      // would otherwise leave orphaned STORES_CREATING state in Meta.
      try {
        let failedState = await loadCreationState(Meta, 'v1');
        if (failedState && failedState.state !== ORG_CREATION_STATES.COMPLETE) {
          failedState = markAsFailed(failedState, error.message);
          await saveCreationState(failedState, Meta);
        }
      } catch (stateError) {
        logger.error(`[v1]: Failed to mark creation state as FAILED: ${stateError.message}`);
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
      if (!coinCheck.success) {
        throw new Error(
          `Cannot resume organization creation: ${coinCheck.error || 'Insufficient spendable coins'}. ` +
          'Please ensure wallet has sufficient balance, coin management has split coins, and no pending transactions.',
        );
      }
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

      // Trigger mirror check to create mirrors for the new organization immediately
      // Wrapped in try-catch so mirror failures don't fail org creation
      // The periodic mirror-check task will retry if this fails
      try {
        logState(state, 'Triggering mirror check to create mirrors for new organization');
        await runMirrorCheck();
        logState(state, 'Mirror check completed successfully');
      } catch (mirrorError) {
        logState(state, `Mirror check failed (will be retried by periodic task): ${mirrorError.message}`, 'warn');
      }

      // Mark complete and clear state
      updateOrgLockStatus(lockToken, 'Organization creation complete');
      state = updateState(state, { state: ORG_CREATION_STATES.COMPLETE });
      await clearCreationState(Meta, 'v1');

      logState(state, `Organization creation complete. orgUid: ${orgUid}`);
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

    // Create all stores in parallel, each with independent retry logic
    const createPromises = storesToCreate.map(async (storeType) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logState(state, `Creating ${storeType} store (attempt ${attempt}/${maxRetries})`);
          const storeId = await datalayer.createDataLayerStoreWithRetry();
          logState(state, `Created ${storeType} store: ${storeId}`);
          return { storeType, storeId, success: true };
        } catch (error) {
          if (isTransientWalletError(error) && attempt < maxRetries) {
            logState(
              state,
              `Transient error creating ${storeType} store ` +
                `(attempt ${attempt}/${maxRetries}): ${error.message}. ` +
                `Retrying in ${retryDelayMs / 1000}s...`,
              'warn',
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
          logState(state, `Failed to create ${storeType} store: ${error.message}`, 'error');
          return { storeType, storeId: null, success: false, error: error.message };
        }
      }
      return { storeType, storeId: null, success: false, error: 'Retry loop exhausted without result' };
    });

    const results = await Promise.all(createPromises);

    // Update state with created store IDs
    for (const result of results) {
      if (result.success) {
        state = markStoreCreated(state, result.storeType, result.storeId);
      }
    }
    await saveCreationState(state, Meta);

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
   * Push data to stores sequentially with a short delay between each.
   *
   * Calls pushChangeListToDataLayer directly, bypassing the hasUnconfirmedTransactions
   * gate in pushChangesWhenStoreIsAvailable. With coin splitting we maintain multiple
   * coins specifically so concurrent/back-to-back transactions work; the unconfirmed-tx
   * check is a legacy guard from single-coin days and would force a 30s retry delay
   * on the second push. We already know stores are confirmed from the previous step.
   *
   * Pushes are staggered by 2s so two batch_update RPCs don't hit the wallet at the
   * exact same instant (avoids a coin-selection race in the Chia wallet).
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
          // Call persistance directly, skipping the legacy hasUnconfirmedTransactions gate.
          // With coin splitting we have multiple coins so back-to-back txs are fine.
          success = await pushChangeListToDataLayer(storeId, changeList, { skipTransactionWait: true });
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
  static async reconcileOrganization(organization) {
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

    logger.debug(
      `running the organization model subscription process on ${orgUid}`,
    );

    let organizationStoreIdsFromDatalayer = null;
    try {
      organizationStoreIdsFromDatalayer =
        await Organization.subscribeToOrganization(orgUid);
    } catch (error) {
      logger.error(
        `failed to subscribe to, or validate subscribed store data for organization ${orgUid}. Error: ${error.message}`,
      );
      throw new Error(
        `failed to subscribe to, or validate subscribed store data for organization ${orgUid}`,
      );
    }

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
      try {
        await datalayer.subscribeToStoreOnDataLayer(orgUid);
      } catch (error) {
        logger.warn(
          `[v1]: Could not subscribe to store for ${orgUid}, skipping import: ${error.message}`,
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

    const storesToUnsubscribe = [
      organizationStores.orgUid,
      organizationStores.dataModelVersionStoreId,
      organizationStores.registryId,
    ];
    const failedUnsubscribes = [];

    storesToUnsubscribe.forEach((storeId) => {
      if (!storeId) {
        const message = `organization stores cannot be nil. found nil store id associated with organization ${organizationStores.orgUid}`;
        logger.error(message);
        throw new Error(message);
      }
    });

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

  /**
   * removes all records of an organization from all models with an `orgUid` column
   * @param orgUid
   */
  static async deleteAllOrganizationData(orgUid) {
    logger.verbose('[v1]: acquiring add/delete org mutex to delete organization');
    const releaseAddDeleteMutex =
      await addOrDeleteOrganizationRecordMutex.acquire();

    logger.verbose(
      'acquiring processingSyncRegistriesTransaction mutex to delete organization',
    );
    const releaseAuditTransactionMutex =
      await processingSyncRegistriesTransactionMutex.acquire();

    const transaction = await sequelize.transaction();
    try {
      await Organization.destroy({ where: { orgUid }, transaction });

      for (const modelKey of Object.keys(ModelKeys)) {
        await ModelKeys[modelKey].destroy({ where: { orgUid }, transaction });
      }

      await Staging.truncate({ transaction });
      await FileStore.destroy({ where: { orgUid }, transaction });
      await Audit.destroy({ where: { orgUid }, transaction });

      await transaction.commit();

      await Meta.addUserDeletedOrgUid(orgUid);
    } catch (error) {
      logger.error(
        `failed to delete all db records for organization ${orgUid}, rolling back changes. Error: ${error.message}`,
      );
      await transaction.rollback();
      throw new Error(
        `an error occurred while deleting records corresponding to organization ${orgUid}. no changes have been made`,
      );
    } finally {
      releaseAddDeleteMutex();
      releaseAuditTransactionMutex();
    }
  }

  /**
   * Synchronizes metadata for all subscribed organizations.
   */
  static async syncOrganizationMeta() {
    try {
      const allSubscribedOrganizations = await Organization.findAll({
        where: { subscribed: true },
        raw: true,
      });

      for (const organization of allSubscribedOrganizations) {
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
