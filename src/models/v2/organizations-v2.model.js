'use strict';

import { Sequelize, Model } from 'sequelize';
import _ from 'lodash';

import { sequelizeV2, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import OrganizationsV2Mirror from './organizations-v2.model.mirror.js';
import datalayer from '../../datalayer';
import { getStoreData as getRawStoreData } from '../../datalayer/persistance.js';
import * as simulator from '../../datalayer/simulator.js';
import { loggerV2 } from '../../config/logger.js';
import { getConfig } from '../../utils/config-loader';
import { decodeHex, decodeDataLayerResponse } from '../../utils/datalayer-utils.js';
const { USE_SIMULATOR, AUTO_SUBSCRIBE_FILESTORE } = getConfig().APP;

// Helper to get store data - returns raw format with keys_values for both modes
// Uses simulator in simulator mode, otherwise uses persistance.getStoreData directly
// (syncService.getStoreData decodes data before callback, but we need raw hex format)
const getStoreDataPromise = async (storeId) => {
  if (USE_SIMULATOR) {
    return await simulator.getStoreData(storeId);
  } else {
    // Use raw persistance.getStoreData to get hex-encoded keys_values
    // (syncService.getStoreData decodes before callback, which breaks our checks)
    return await getRawStoreData(storeId);
  }
};

// Import V1 Organization model to check for existing V1 org
import { Organization } from '../organizations/organizations.model.js';
// Import V2 Staging model for pending commits check
import StagingV2 from './staging-v2.model.js';
// Import utilities for import and subscription operations
import { FileStore } from '../index.js';
import { assertStoreIsOwned } from '../../utils/data-assertions.js';
import {
  getRoot,
  getSubscriptions,
} from '../../datalayer/persistance.js';
import {
  addOrDeleteOrganizationRecordMutex,
} from '../../utils/model-utils.js';
import {
  processingSyncRegistriesTransactionMutexV2,
} from '../../utils/v2-mutex-utils.js';
import wallet from '../../datalayer/wallet.js';
import { isDlStoreSynced } from '../../utils/datalayer-utils.js';
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

import ModelTypes from './organizations-v2.modeltypes.cjs';
import { runMirrorCheckV2 } from '../../tasks/mirror-check-v2.js';
import { updateOrgLockStatus } from '../../utils/org-operation-lock.js';

const { isTransientWalletError } = wallet;

class OrganizationsV2 extends Model {
  static async create(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await OrganizationsV2Mirror.create(values, mirrorOptions);
    });
    const result = await super.create(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await OrganizationsV2Mirror.bulkCreate(values, mirrorOptions);
    });
    const result = await super.bulkCreate(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await OrganizationsV2Mirror.update(values, mirrorOptions);
    });
    const result = await super.update(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await OrganizationsV2Mirror.upsert(values, mirrorOptions);
    });
    const result = await super.upsert(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    safeMirrorDbHandlerV2(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await OrganizationsV2Mirror.destroy(mirrorOptions);
    });
    const result = await super.destroy(options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Create a V2 home organization (for new users only)
   * Uses parallel store creation for faster organization setup.
   *
   * @param {string} name - Organization name
   * @param {string} icon - Organization icon (base64 string)
   * @param {string} dataVersion - Data version (defaults to 'v2')
   * @returns {Promise<string>} The new organization UID
   * @throws {Error} If V1 org exists or V2 org already exists
   */
  static async createHomeOrganization(name, icon, dataVersion = 'v2', lockToken = null) {
    // Import MetaV2 for state persistence
    const { MetaV2 } = await import('./index.js');

    try {
      loggerV2.info('[v2]: Creating New V2 Organization using parallel store creation.');

      // Ensure name is provided
      if (!name) {
        throw new Error('Organization name is required');
      }

      // Icon is optional - use provided value or default to empty string
      const iconValue = icon !== undefined && icon !== null ? icon : '';

      // Check for existing V2 home org
      const existingV2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      if (existingV2Org && existingV2Org.org_uid !== 'PENDING') {
        loggerV2.info('[v2]: V2 home organization already exists');
        return existingV2Org.org_uid;
      }

      // Check for in-progress creation (for recovery)
      let state = await loadCreationState(MetaV2, 'v2');
      if (state && state.state !== ORG_CREATION_STATES.COMPLETE && state.state !== ORG_CREATION_STATES.FAILED) {
        loggerV2.info('[v2]: Found in-progress organization creation, resuming...');
        // Resume from where we left off
        return await OrganizationsV2._resumeOrganizationCreation(state, MetaV2, lockToken);
      }

      // CRITICAL: Check for V1 home org in database (only if V1 is enabled)
      // When V1 is disabled, the V1 organizations table may not exist
      const configV1 = getConfig();
      const enableV1 = configV1?.ENABLE !== false; // Default to true if not set

      if (enableV1) {
        const v1Org = await Organization.findOne({
          where: { isHome: true },
          raw: true,
        });

        if (v1Org) {
          // V1 org exists - check for V1 singleton in datalayer
          if (v1Org.dataModelVersionStoreId) {
            try {
              const singletonData = await getStoreDataPromise(
                v1Org.dataModelVersionStoreId,
              );

              // Handle simulator mode - getStoreData might return Error object or false
              if (singletonData && !(singletonData instanceof Error) && singletonData.keys_values) {
                // Check if singleton has v1 key
                const hasV1Key = singletonData.keys_values.some((kv) => {
                  try {
                    const decodedKey = decodeHex(kv.key);
                    return decodedKey === 'v1';
                  } catch {
                    return false;
                  }
                });

                if (hasV1Key) {
                  throw new Error(
                    'V1 organization detected. Please use /v2/organizations/upgrade endpoint',
                  );
                }
              }
            } catch (error) {
              // If getStoreData fails, we still error because V1 org exists
              loggerV2.debug(`[v2]: Failed to check V1 singleton: ${error.message}`);
            }
          }

          // If V1 org exists but no singleton check possible, still error
          throw new Error(
            'V1 organization detected. Please use /v2/organizations/upgrade endpoint',
          );
        }
      }

      // Initialize state for new creation
      state = createInitialState(name, iconValue, dataVersion, 'v2');
      await saveCreationState(state, MetaV2);

      // Create PENDING record in database
      const existingPending = await OrganizationsV2.findOne({
        where: { org_uid: 'PENDING' },
        raw: true,
      });

      if (!existingPending) {
        await OrganizationsV2.create({
          org_uid: 'PENDING',
          registry_id: null,
          data_model_version_store_id: null,
          is_home: true,
          subscribed: false,
          name: '',
          icon: '',
        });
      }

      // Wait for sufficient spendable coins before starting store creation
      // We need 4 SEPARATE coins (one per parallel store creation), each large enough to cover COIN_SIZE + fee
      const coinCheck = await wallet.waitForSpendableCoins(4);
      if (!coinCheck.success) {
        throw new Error(
          `Cannot create organization: ${coinCheck.error || 'Insufficient spendable coins'}. ` +
          'Please ensure wallet has sufficient balance, coin management has split coins, and no pending transactions.',
        );
      }
      loggerV2.info(`[v2]: Proceeding with org creation, ${coinCheck.coinCount} coins available`);

      // Execute the creation process
      return await OrganizationsV2._executeOrganizationCreation(state, MetaV2, lockToken);
    } catch (error) {
      loggerV2.error(
        `[v2]: create V2 organization process failed. Error: ${error.message}`,
      );
      await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
      // Mark state as FAILED so the 409 guard in the controller doesn't
      // permanently block new creation attempts within the same session.
      // The startup recovery task only runs once, so mid-session failures
      // would otherwise leave orphaned STORES_CREATING state in Meta.
      try {
        let failedState = await loadCreationState(MetaV2, 'v2');
        if (failedState && failedState.state !== ORG_CREATION_STATES.COMPLETE) {
          failedState = markAsFailed(failedState, error.message);
          await saveCreationState(failedState, MetaV2);
        }
      } catch (stateError) {
        loggerV2.error(`[v2]: Failed to mark creation state as FAILED: ${stateError.message}`);
      }
      throw error;
    }
  }

  /**
   * Resume an in-progress organization creation (for crash recovery)
   * @param {Object} state - The saved state object
   * @param {Object} MetaV2 - The MetaV2 model
   * @returns {Promise<string>} The organization UID
   * @private
   */
  static async _resumeOrganizationCreation(state, MetaV2, lockToken = null) {
    logState(state, `Resuming from state: ${state.state}`);

    // Check for timeout
    if (hasTimedOut(state)) {
      state = incrementRetryCount(state);
      if (hasExceededMaxRetries(state)) {
        state = markAsFailed(state, 'Organization creation timed out after maximum retries');
        await saveCreationState(state, MetaV2);
        await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
        throw new Error('Organization creation failed: timed out after maximum retries');
      }
      // Reset startedAt for new retry attempt
      state = updateState(state, { startedAt: new Date().toISOString() });
      await saveCreationState(state, MetaV2);
    }

    const neededCoins = getStoresToCreate(state).length;
    if (neededCoins > 0) {
      const coinCheck = await wallet.waitForSpendableCoins(neededCoins);
      if (!coinCheck.success) {
        throw new Error(
          `Cannot resume organization creation: ${coinCheck.error || 'Insufficient spendable coins'}. ` +
          'Please ensure wallet has sufficient balance, coin management has split coins, and no pending transactions.',
        );
      }
      loggerV2.info(`[v2]: Resuming org creation, ${coinCheck.coinCount} coins available (need ${neededCoins})`);
    }

    return await OrganizationsV2._executeOrganizationCreation(state, MetaV2, lockToken);
  }

  /**
   * Execute the organization creation process from the current state
   * @param {Object} state - The current state object
   * @param {Object} MetaV2 - The MetaV2 model
   * @returns {Promise<string>} The organization UID
   * @private
   */
  static async _executeOrganizationCreation(state, MetaV2, lockToken = null) {
    try {
      // PHASE 1: Create stores in parallel
      if (state.state === ORG_CREATION_STATES.INITIALIZING ||
          state.state === ORG_CREATION_STATES.STORES_CREATING) {
        updateOrgLockStatus(lockToken, 'Creating stores on blockchain');
        state = updateState(state, { state: ORG_CREATION_STATES.STORES_CREATING });
        await saveCreationState(state, MetaV2);

        state = await OrganizationsV2._createStoresInParallel(state, MetaV2);
      }

      // Wait for all stores to be confirmed
      if (state.state === ORG_CREATION_STATES.STORES_CREATING) {
        updateOrgLockStatus(lockToken, 'Waiting for stores to confirm on blockchain');
        state = await OrganizationsV2._waitForStoresConfirmation(state, MetaV2);
      }

      // PHASE 2: Push data to stores in parallel
      if (state.state === ORG_CREATION_STATES.STORES_CONFIRMED ||
          state.state === ORG_CREATION_STATES.DATA_PUSHING) {
        updateOrgLockStatus(lockToken, 'Writing data to stores');
        state = updateState(state, { state: ORG_CREATION_STATES.DATA_PUSHING });
        await saveCreationState(state, MetaV2);

        state = await OrganizationsV2._pushDataInParallel(state, MetaV2);
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
      await saveCreationState(state, MetaV2);

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
          const { confirmed, hash } = await getRoot(dataModelVersionStoreId);
          if (confirmed && hash) {
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

      logState(state, 'Adding new V2 home organization to CADT database');

      // Remove any existing org with this UID (in case of partial creation)
      await OrganizationsV2.destroy({ where: { org_uid: orgUid } });

      await Promise.all([
        OrganizationsV2.create({
          org_uid: orgUid,
          org_hash: orgHash,
          data_model_version_store_id: dataModelVersionStoreId,
          data_model_version_store_hash: dataModelVersionStoreHash,
          registry_id: registryId,
          registry_hash: registryHash,
          is_home: true,
          subscribed: USE_SIMULATOR,
          file_store_subscribed: fileStoreId,
          name: state.name,
          icon: state.icon,
        }),
        OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } }),
      ]);

      // Mark subscribed after confirmation
      if (!USE_SIMULATOR) {
        logState(state, 'Waiting for final confirmation');
        await new Promise((resolve, reject) => {
          datalayer.getStoreData(
            orgUid,
            async () => {
              logState(state, 'V2 Organization confirmed, you are ready to go');
              await OrganizationsV2.update(
                { subscribed: true },
                { where: { org_uid: orgUid } },
              );
              resolve();
            },
            (error) => reject(new Error(error)),
          );
        });
      } else {
        await OrganizationsV2.update(
          { subscribed: true },
          { where: { org_uid: orgUid } },
        );
      }

      // Trigger mirror check to create mirrors for the new organization immediately
      // Wrapped in try-catch so mirror failures don't fail org creation
      // The periodic mirror-check task will retry if this fails
      try {
        logState(state, 'Triggering mirror check to create mirrors for new organization');
        await runMirrorCheckV2();
        logState(state, 'Mirror check completed successfully');
      } catch (mirrorError) {
        logState(state, `Mirror check failed (will be retried by periodic task): ${mirrorError.message}`, 'warn');
      }

      // Mark complete and clear state
      updateOrgLockStatus(lockToken, 'Organization creation complete');
      state = updateState(state, { state: ORG_CREATION_STATES.COMPLETE });
      await clearCreationState(MetaV2, 'v2');

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
   * @param {Object} MetaV2 - The MetaV2 model
   * @returns {Promise<Object>} Updated state
   * @private
   */
  static async _createStoresInParallel(state, MetaV2) {
    const storesToCreate = getStoresToCreate(state);

    if (storesToCreate.length === 0) {
      logState(state, 'All stores already created');
      return state;
    }

    logState(state, `Creating ${storesToCreate.length} stores in parallel`);

    // In simulator mode, use fixed IDs
    if (USE_SIMULATOR) {
      const simulatorIds = {
        [STORE_TYPES.ORG_UID]: 'f1c54511-865e-4611-976c-7c3c1f704662',
        [STORE_TYPES.REGISTRY]: 'e9241e7e-b4bd-4cde-ae35-5b42235f9d3b',
        [STORE_TYPES.DATA_MODEL_VERSION]: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        [STORE_TYPES.FILE_STORE]: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
      };

      for (const storeType of storesToCreate) {
        state = markStoreCreated(state, storeType, simulatorIds[storeType]);
        state = markStoreConfirmed(state, storeType);
      }
      await saveCreationState(state, MetaV2);
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
    await saveCreationState(state, MetaV2);

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
   * @param {Object} MetaV2 - The MetaV2 model
   * @returns {Promise<Object>} Updated state
   * @private
   */
  static async _waitForStoresConfirmation(state, MetaV2) {
    if (USE_SIMULATOR) {
      // In simulator mode, stores are immediately confirmed
      state = updateState(state, { state: ORG_CREATION_STATES.STORES_CONFIRMED });
      await saveCreationState(state, MetaV2);
      return state;
    }

    const storesAwaitingConfirmation = getStoresAwaitingConfirmation(state);
    if (storesAwaitingConfirmation.length === 0) {
      logState(state, 'All stores already confirmed');
      state = updateState(state, { state: ORG_CREATION_STATES.STORES_CONFIRMED });
      await saveCreationState(state, MetaV2);
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
    await saveCreationState(state, MetaV2);

    // Check if all stores confirmed
    if (allStoresConfirmed(state)) {
      state = updateState(state, { state: ORG_CREATION_STATES.STORES_CONFIRMED });
      await saveCreationState(state, MetaV2);
      logState(state, 'All stores confirmed on blockchain');
    } else {
      const unconfirmed = results.filter((r) => !r.confirmed).map((r) => r.storeType);
      throw new Error(`Stores failed to confirm within timeout: ${unconfirmed.join(', ')}`);
    }

    return state;
  }

  /**
   * Detect rejected txs in the DL wallet and auto-clear them.
   * Non-blocking and best-effort — failures are logged but don't propagate.
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
          `V2 _pushDataInParallel failed for ${storeType} store ${storeId}, scheduling retry`;
        await wallet.clearRejectedTransactions(dlWalletId, txIds, context);
      }
    } catch (error) {
      loggerV2.debug(`[v2]: _checkAndClearRejectedTxs non-fatal error: ${error.message}`);
    }
  }

  /**
   * Push data to stores in parallel
   * @param {Object} state - Current state
   * @param {Object} MetaV2 - The MetaV2 model
   * @returns {Promise<Object>} Updated state
   * @private
   */
  static async _pushDataInParallel(state, MetaV2) {
    const storesNeedingData = getStoresNeedingData(state);

    if (storesNeedingData.length === 0) {
      logState(state, 'All store data already written');
      return state;
    }

    logState(state, `Pushing data to ${storesNeedingData.length} stores in parallel`);

    const orgUidStoreId = state.stores[STORE_TYPES.ORG_UID].id;
    const dataModelVersionStoreId = state.stores[STORE_TYPES.DATA_MODEL_VERSION].id;
    const registryStoreId = state.stores[STORE_TYPES.REGISTRY].id;
    const fileStoreId = state.stores[STORE_TYPES.FILE_STORE].id;

    const pushPromises = [];

    // Push data to org store if needed
    if (storesNeedingData.includes(STORE_TYPES.ORG_UID)) {
      pushPromises.push(
        (async () => {
          try {
            logState(state, `Pushing data to orgUid store ${orgUidStoreId}`);
            await datalayer.syncDataLayer(
              orgUidStoreId,
              {
                registryId: dataModelVersionStoreId, // Points to singleton
                fileStoreId,
                name: state.name,
                icon: state.icon,
              },
              () => {}, // No revert needed - we have state tracking now
            );
            return { storeType: STORE_TYPES.ORG_UID, success: true };
          } catch (error) {
            await OrganizationsV2._checkAndClearRejectedTxs(STORE_TYPES.ORG_UID, orgUidStoreId);
            return { storeType: STORE_TYPES.ORG_UID, success: false, error: error.message };
          }
        })(),
      );
    }

    // Push data to dataModelVersion store if needed
    if (storesNeedingData.includes(STORE_TYPES.DATA_MODEL_VERSION)) {
      pushPromises.push(
        (async () => {
          try {
            logState(state, `Pushing data to dataModelVersion store ${dataModelVersionStoreId}`);
            await datalayer.syncDataLayer(
              dataModelVersionStoreId,
              {
                [state.dataVersion]: registryStoreId, // Only v2 key for new users
              },
              () => {},
            );
            return { storeType: STORE_TYPES.DATA_MODEL_VERSION, success: true };
          } catch (error) {
            await OrganizationsV2._checkAndClearRejectedTxs(STORE_TYPES.DATA_MODEL_VERSION, dataModelVersionStoreId);
            return { storeType: STORE_TYPES.DATA_MODEL_VERSION, success: false, error: error.message };
          }
        })(),
      );
    }

    const results = await Promise.all(pushPromises);

    // Update state with data written status
    for (const result of results) {
      if (result.success) {
        state = markStoreDataWritten(state, result.storeType);
      }
    }
    await saveCreationState(state, MetaV2);

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
    const { MetaV2 } = await import('./index.js');
    const state = await loadCreationState(MetaV2, 'v2');
    return getStatusSummary(state);
  }

  /**
   * Upgrade from V1 to V2 organization (for existing V1 users)
   * Creates a V2 home org based on existing V1 org, sharing the dataModelVersionStoreId singleton
   * @param {string} name - Organization name (from V1 org)
   * @param {string} icon - Organization icon (from V1 org)
   * @returns {Promise<string>} The new V2 organization UID
   * @throws {Error} If V1 org doesn't exist or V2 org already exists
   */
  static async upgradeFromV1(name, icon, lockToken = null) {
    try {
      loggerV2.info('[v2]: Upgrading from V1 to V2 Organization, This could take a while.');
      updateOrgLockStatus(lockToken, 'Validating V1 singleton');

      // CRITICAL: Check if V1 is enabled before accessing V1 tables
      const configV1 = getConfig();
      const enableV1 = configV1?.ENABLE !== false;

      if (!enableV1) {
        throw new Error(
          'V1 is disabled. Cannot upgrade from V1 when V1 is not enabled.',
        );
      }

      // CRITICAL: Check if V1 home org exists
      const v1Org = await Organization.findOne({
        where: { isHome: true },
        raw: true,
      });

      if (!v1Org) {
        throw new Error(
          'V1 home organization not found. Cannot upgrade without existing V1 organization.',
        );
      }

      // Get V1 org data
      const v1OrgUid = v1Org.orgUid;
      const v1RegistryId = v1Org.registryId;
      const v1FileStoreId = v1Org.fileStoreId;
      const v1DataModelVersionStoreId = v1Org.dataModelVersionStoreId;

      if (!v1DataModelVersionStoreId) {
        throw new Error(
          'V1 organization missing dataModelVersionStoreId. Cannot upgrade.',
        );
      }

      // CRITICAL: Read current singleton data from datalayer
      // Use getSubscribedStoreData in production mode to ensure store is subscribed and synced
      let singletonData = null;

      if (USE_SIMULATOR) {
        // In simulator mode, use getStoreDataPromise directly (no subscription needed)
        const storeData = await getStoreDataPromise(v1DataModelVersionStoreId);
        if (storeData && storeData.keys_values) {
          const decodedData = decodeDataLayerResponse(storeData);
          singletonData = decodedData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});
        } else {
          throw new Error(
            'Cannot read V1 singleton data from datalayer. Cannot upgrade.',
          );
        }
      } else {
        // In production mode, use getSubscribedStoreData with timeout
        const timeout = Date.now() + 600000; // 10 minutes

        while (!singletonData) {
          try {
            singletonData = await datalayer.getSubscribedStoreData(
              v1DataModelVersionStoreId,
              undefined,
              true, // wait for sync
            );
            break;
          } catch (error) {
            if (Date.now() > timeout) {
              throw new Error(
                `Timeout reading V1 singleton data from datalayer: ${error.message}. Cannot upgrade.`,
              );
            }
            loggerV2.debug(`[v2]: ${error.message}. RETRYING`);
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        }
      }

      if (!singletonData) {
        throw new Error(
          'Cannot read V1 singleton data from datalayer. Cannot upgrade.',
        );
      }

      const v1RegistryStoreId = singletonData.v1;
      if (!v1RegistryStoreId) {
        throw new Error(
          'V1 singleton missing v1 key. Cannot upgrade without v1 registry store ID.',
        );
      }

      // CRITICAL: Check if V2 home org already exists
      const existingV2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      // Check if singleton already has v2 key
      const singletonHasV2Key = singletonData.v2 !== undefined;

      if (existingV2Org) {
        // V2 org exists - check if singleton has v2 key
        if (singletonHasV2Key) {
          // Both exist - upgrade already complete
          throw new Error(
            'V2 home organization already exists and singleton has v2 key. Upgrade already complete.',
          );
        } else {
          // V2 org exists but singleton missing v2 key - this is a partial upgrade
          // We'll use the existing V2 org's registry ID to complete the singleton update
          loggerV2.warn(
            '[v2]: V2 organization exists but singleton missing v2 key. Completing partial upgrade.',
          );
          const newV2RegistryStoreId = existingV2Org.registry_id;
          const sharedDataModelVersionStoreId = v1DataModelVersionStoreId;

          // Verify singleton store is owned (skip in simulator mode)
          if (!USE_SIMULATOR) {
            try {
              await assertStoreIsOwned(sharedDataModelVersionStoreId);
            } catch (error) {
              throw new Error(
                `Cannot complete upgrade: The singleton store (${sharedDataModelVersionStoreId}) is not owned by the current wallet. ` +
                `Original error: ${error.message}`,
              );
            }
          }

          // Add v2 key to singleton
          await datalayer.syncDataLayer(
            sharedDataModelVersionStoreId,
            { v2: newV2RegistryStoreId },
            null, // No revert callback needed - org already exists
          );

          if (!USE_SIMULATOR) {
            await new Promise((resolve) => setTimeout(() => resolve(), 30000));
            await datalayer.waitForAllTransactionsToConfirm();
          }

          loggerV2.info('[v2]: Singleton v2 key added successfully. Upgrade complete.');
          return existingV2Org.org_uid;
        }
      } else if (singletonHasV2Key) {
        // CRITICAL: Singleton has v2 key but no V2 org in database
        // This means a previous upgrade completed on the blockchain but the database was reset/cleared
        // We cannot create a new v2 registry store because the singleton already points to an existing one
        // User needs to either:
        // 1. Re-subscribe to the existing v2 organization, or
        // 2. Delete the v2 key from the singleton (requires blockchain transaction)
        const existingV2RegistryId = singletonData.v2;
        throw new Error(
          `Cannot upgrade: The singleton store already has a v2 key pointing to registry ${existingV2RegistryId}. ` +
            `This indicates a previous V2 upgrade was completed but the local database was reset. ` +
            `To resolve this, either: ` +
            `(1) Re-subscribe to the existing V2 organization using the original org_uid, or ` +
            `(2) Delete the v2 key from the singleton store ${v1DataModelVersionStoreId} and try again.`,
        );
      }

      // Create new V2 registry store (v2 data store - different from V1)
      // CRITICAL: Reuse v1OrgUid and v1FileStoreId - do NOT create new stores for these
      loggerV2.verbose('[v2]: upgradeFromV1() is creating new V2 registryId store');
      updateOrgLockStatus(lockToken, 'Creating V2 registry store');
      let newV2RegistryStoreId;
      if (USE_SIMULATOR) {
        newV2RegistryStoreId = 'v2-registry-' + Date.now();
      } else {
        const maxStoreCreateRetries = 10;
        const storeCreateRetryDelayMs = 30000;

        for (let attempt = 1; attempt <= maxStoreCreateRetries; attempt++) {
          try {
            await wallet.waitForSpendableCoins(1);
            newV2RegistryStoreId = await datalayer.createDataLayerStoreWithRetry();
            break;
          } catch (error) {
            if (isTransientWalletError(error) && attempt < maxStoreCreateRetries) {
              loggerV2.warn(
                `[v2]: Wallet not ready during V2 registry store creation ` +
                `(attempt ${attempt}/${maxStoreCreateRetries}): ${error.message}. ` +
                `Retrying in ${storeCreateRetryDelayMs / 1000}s...`,
              );
              await new Promise((resolve) => setTimeout(resolve, storeCreateRetryDelayMs));
              continue;
            }
            throw error;
          }
        }
      }

      // CRITICAL: Use existing dataModelVersionStoreId singleton (do NOT create new one)
      const sharedDataModelVersionStoreId = v1DataModelVersionStoreId;

      const revertUpgradeIfFailed = async () => {
        loggerV2.error(
          '[v2]: upgrade from V1 to V2 organization process failed. removing failed V2 organization records. please try again',
        );
        await OrganizationsV2.destroy({ where: { org_uid: v1OrgUid } });
        await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
      };

      if (!USE_SIMULATOR) {
        updateOrgLockStatus(lockToken, 'Waiting for V2 registry store to confirm on blockchain');
        loggerV2.info(
          '[v2]: upgrade from V1 to V2 organization process is waiting for V2 registry store creation to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      // Get the root hash of the newly created V2 registry store
      const newV2RegistryRoot = await getRoot(newV2RegistryStoreId);
      const newV2RegistryHash = newV2RegistryRoot?.hash
        ? (newV2RegistryRoot.hash.startsWith('0x') ? newV2RegistryRoot.hash : `0x${newV2RegistryRoot.hash}`)
        : '0x0000000000000000000000000000000000000000000000000000000000000000';

      loggerV2.verbose(
        `[v2]: the blockchain reported new V2 registry store ${newV2RegistryStoreId} has confirmed (hash: ${newV2RegistryHash}). ` +
          `Reusing V1 orgUid: ${v1OrgUid} and V1 fileStoreId: ${v1FileStoreId}`,
      );

      // CRITICAL: Check if singleton already has v2 key (idempotent upgrade)
      // singletonHasV2Key was already declared above - reuse it here
      // Re-check singleton data in case it was updated (though unlikely at this point)
      const currentSingletonHasV2Key = singletonData.v2 !== undefined;

      if (currentSingletonHasV2Key) {
        loggerV2.info(
          `[v2]: Singleton store ${sharedDataModelVersionStoreId} already has v2 key. Skipping singleton update.`,
        );
      } else {
        updateOrgLockStatus(lockToken, 'Updating singleton store with v2 key');
        loggerV2.info(
          `[v2]: updating shared data model version store ${sharedDataModelVersionStoreId} to add v2 key`,
        );

        // CRITICAL: Verify singleton store is owned before attempting to update
        // The singleton store must be owned by the current wallet to add the v2 key
        // Skip ownership check in simulator mode
        if (!USE_SIMULATOR) {
          try {
            await assertStoreIsOwned(sharedDataModelVersionStoreId);
          } catch (error) {
            throw new Error(
              `Cannot upgrade V1 organization: The singleton store (${sharedDataModelVersionStoreId}) is not owned by the current wallet. ` +
              `The singleton store must be owned by this wallet to perform the upgrade. ` +
              `Please ensure you are using the same wallet that created the V1 organization, or transfer the singleton store to this wallet. ` +
              `Original error: ${error.message}`,
            );
          }
        }

        // CRITICAL: Add v2 key to existing singleton (preserve v1 key)
        // Only insert the new v2 key - don't re-insert existing keys (v1 already exists)
        // syncDataLayer always uses 'insert' action, so re-inserting v1 would cause KeyAlreadyPresentError
        if (!USE_SIMULATOR) {
          await datalayer.waitForAllTransactionsToConfirm();
        }
        await datalayer.syncDataLayer(
          sharedDataModelVersionStoreId,
          { v2: newV2RegistryStoreId }, // Only insert the new v2 key
          revertUpgradeIfFailed,
        );
      }

      if (!USE_SIMULATOR) {
        updateOrgLockStatus(lockToken, 'Waiting for data model version update to confirm on blockchain');
        loggerV2.info(
          '[v2]: upgrade from V1 to V2 organization process is waiting for data model version update to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      // Get the updated hash of the data model version store (singleton) after adding the v2 key
      // The hash changes when we add the v2 key, so we can't use the V1 hash
      const dataModelVersionRoot = await getRoot(sharedDataModelVersionStoreId);
      const dataModelVersionStoreHash = dataModelVersionRoot?.hash
        ? (dataModelVersionRoot.hash.startsWith('0x') ? dataModelVersionRoot.hash : `0x${dataModelVersionRoot.hash}`)
        : '0x0000000000000000000000000000000000000000000000000000000000000000';

      loggerV2.verbose(
        `[v2]: data model version store ${sharedDataModelVersionStoreId} hash after v2 key addition: ${dataModelVersionStoreHash}`,
      );

      updateOrgLockStatus(lockToken, 'Adding V2 home organization to database');
      loggerV2.info('[v2]: adding new V2 home organization to CADT database');
      // CRITICAL: Use v1OrgUid and v1FileStoreId - shared identity between v1 and v2
      // Note: data_model_version_store_hash uses the UPDATED hash (after v2 key addition), not V1 hash
      await OrganizationsV2.create({
        org_uid: v1OrgUid, // SAME as V1 - shared org_uid
        org_hash: v1Org.orgHash, // Copy from V1 - shared org store
        data_model_version_store_id: sharedDataModelVersionStoreId, // SAME as V1 - shared singleton
        data_model_version_store_hash: dataModelVersionStoreHash, // Updated hash after adding v2 key
        registry_id: newV2RegistryStoreId, // NEW registry store for v2 data
        registry_hash: newV2RegistryHash, // Hash from datalayer RPC
        is_home: true,
        subscribed: USE_SIMULATOR,
        file_store_subscribed: v1FileStoreId, // SAME as V1 - shared file store
        name,
        icon,
      });

      const onConfirm = async () => {
        updateOrgLockStatus(lockToken, 'V2 Organization upgrade confirmed');
        loggerV2.info('[v2]: V2 Organization upgrade confirmed, you are ready to go');
        await OrganizationsV2.update(
          {
            subscribed: true,
          },
          { where: { org_uid: v1OrgUid } },
        );

        // Trigger mirror check to create mirrors for the upgraded organization immediately
        // Wrapped in try-catch so mirror failures don't fail org upgrade
        // The periodic mirror-check task will retry if this fails
        try {
          loggerV2.info('[v2]: Triggering mirror check to create mirrors for upgraded organization');
          await runMirrorCheckV2();
          loggerV2.info('[v2]: Mirror check completed successfully');
        } catch (mirrorError) {
          loggerV2.warn(`[v2]: Mirror check failed (will be retried by periodic task): ${mirrorError.message}`);
        }
      };

      if (!USE_SIMULATOR) {
        loggerV2.info('[v2]: Waiting for V2 Organization upgrade to be confirmed');
        // In non-simulator mode, use callback-based getStoreData to wait for confirmation
        // We check the v1OrgUid store since that's the shared orgUid store
        datalayer.getStoreData(
          v1OrgUid,
          onConfirm,
          revertUpgradeIfFailed,
        );
      } else {
        // In simulator mode, data is immediately available
        // Await the update to ensure it completes before returning
        await onConfirm();
      }

      return v1OrgUid;
    } catch (error) {
      loggerV2.error(
        `[v2]: upgrade from V1 to V2 organization process failed. removing failed V2 organization records. please try again. Error: ${error.message}`,
      );
      await OrganizationsV2.destroy({ where: { is_home: true } });
      throw error;
    }
  }

  /**
   * Get V2 home organization
   * @param {boolean} includeAddress - Whether to include XCH address and file store subscription status
   * @returns {Promise<Object|null>} Home organization record or null if not found
   */
  static async getHomeOrg(includeAddress = true) {
    const myOrganization = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });

    if (!myOrganization) {
      return null;
    }

    // Parse metadata JSON if exists
    if (myOrganization.metadata) {
      try {
        const parsedMetadata = JSON.parse(myOrganization.metadata);

        // Add each key from parsedMetadata to myOrganization
        for (const key in parsedMetadata) {
          if (Object.prototype.hasOwnProperty.call(parsedMetadata, key)) {
            myOrganization[key] = parsedMetadata[key];
          }
        }

        // Delete the original metadata property
        delete myOrganization.metadata;
      } catch (error) {
        loggerV2.warn('[v2]: Failed to parse organization metadata', { error: error.message });
      }
    }

    if (includeAddress) {
      myOrganization.xchAddress = await datalayer.getPublicAddress();
      myOrganization.fileStoreSubscribed = myOrganization.file_store_subscribed || false;
      return myOrganization;
    }

    // If not including address, check sync status based on pending commits
    const pendingCommitsCount = await StagingV2.count({
      where: { committed: true },
    });

    myOrganization.synced =
      myOrganization.synced === true && pendingCommitsCount === 0;

    return myOrganization;
  }

  /**
   * Get all organizations as a map/dictionary
   * @returns {Promise<Object>} Map of orgUid -> org data
   */
  static async getOrgsMap() {
    loggerV2.silly(
      '[v2]: [MIRROR_DEBUG] Starting getOrgsMap() - querying V2 organizations from database',
    );

    const organizations = await OrganizationsV2.findAll({
      attributes: [
        'org_uid',
        'org_hash',
        'name',
        'icon',
        'is_home',
        'subscribed',
        'synced',
        'file_store_subscribed',
        'registry_id',
        'registry_hash',
        'sync_remaining',
        'data_model_version_store_id',
        'data_model_version_store_hash',
      ],
    });

    loggerV2.silly(
      `[v2]: [MIRROR_DEBUG] Found ${organizations.length} V2 organizations in database`,
    );

    // Add XCH address and balance for home org
    for (let i = 0; i < organizations.length; i++) {
      if (organizations[i].dataValues.is_home) {
        organizations[i].dataValues.xchAddress =
          await datalayer.getPublicAddress();
        organizations[i].dataValues.balance =
          await datalayer.getWalletBalance();

        const pendingCommitsCount = await StagingV2.count({
          where: { committed: true },
        });

        organizations[i].dataValues.synced =
          organizations[i].dataValues.synced === true &&
          pendingCommitsCount === 0;
        break;
      }
    }

    const orgsMap = organizations.reduce((map, current) => {
      map[current.org_uid] = current.dataValues;
      loggerV2.silly(
        `[v2]: [MIRROR_DEBUG] Added to map - org_uid: ${current.org_uid}, name: ${current.dataValues.name}, subscribed: ${current.dataValues.subscribed}`,
      );
      return map;
    }, {});

    loggerV2.silly(
      `[v2]: [MIRROR_DEBUG] Returning V2 organizations map with ${Object.keys(orgsMap).length} entries`,
    );
    return orgsMap;
  }

  /**
   * Helper to upsert data to datalayer for V2 organizations
   * Reads current store data to check for existing keys
   * @param {string} storeId - Store ID to update
   * @param {Object} data - Data to upsert
   * @returns {Promise<void>}
   */
  static async upsertDataLayerV2(storeId, data) {
    loggerV2.info(`[v2]: Syncing ${storeId} (V2)`);

    // Get current store data to check for existing keys
    let currentData = {};
    try {
      if (USE_SIMULATOR) {
        const { getStoreData } = await import('../../datalayer/simulator.js');
        const encodedData = await getStoreData(storeId);
        if (encodedData?.keys_values) {
          const { decodeDataLayerResponse } = await import('../../utils/datalayer-utils.js');
          const decodedData = decodeDataLayerResponse(encodedData);
          currentData = decodedData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});
        }
      } else {
        const { getSubscribedStoreData } = await import('../../datalayer/syncService.js');
        currentData = await getSubscribedStoreData(storeId, undefined, false);
      }
    } catch (error) {
      // Store might not exist yet or have no data - that's okay
      loggerV2.debug(`[v2]: No existing data found for store ${storeId}, proceeding with insert only`);
      currentData = {};
    }

    // Build changelist - delete existing keys, then insert new values
    const { encodeHex } = await import('../../utils/datalayer-utils.js');
    const changeList = [];

    Object.keys(data).forEach((key) => {
      // If key exists, delete it first
      if (currentData[key]) {
        changeList.push({
          action: 'delete',
          key: encodeHex(key),
        });
      }
      // Then insert new value
      changeList.push({
        action: 'insert',
        key: encodeHex(key),
        value: encodeHex(data[key]),
      });
    });

    // Push changes to datalayer
    const { pushChangesWhenStoreIsAvailable } = await import('../../datalayer/writeService.js');
    await pushChangesWhenStoreIsAvailable(storeId, changeList);
  }

  /**
   * Edit home organization metadata (name and/or icon)
   * @param {Object} options - Object with name and/or icon
   * @param {string} [options.name] - New organization name
   * @param {string} [options.icon] - New organization icon (base64 string)
   * @returns {Promise<void>}
   */
  static async editOrgMeta({ name, icon }) {
    const myOrganization = await OrganizationsV2.getHomeOrg();

    if (!myOrganization) {
      throw new Error('Home organization not found');
    }

    const payload = {};

    if (name !== undefined) {
      payload.name = name;
    }

    if (icon !== undefined) {
      payload.icon = icon;
    }

    // Update datalayer using V2-specific method
    await OrganizationsV2.upsertDataLayerV2(myOrganization.org_uid, payload);

    // Update database record
    const updateData = {};
    if (name !== undefined) {
      updateData.name = name;
    }
    if (icon !== undefined) {
      updateData.icon = icon;
    }

    if (Object.keys(updateData).length > 0) {
      await OrganizationsV2.update(updateData, {
        where: { org_uid: myOrganization.org_uid },
      });
    }
  }

  /**
   * Add metadata to home organization
   * @param {Object} payload - Metadata key-value pairs to add
   * @returns {Promise<void>}
   */
  static async addMetadata(payload) {
    const myOrganization = await OrganizationsV2.getHomeOrg();

    if (!myOrganization) {
      throw new Error('Home organization not found');
    }

    // Get raw organization record to access metadata field (getHomeOrg deletes it after parsing)
    const rawOrg = await OrganizationsV2.findOne({
      where: { org_uid: myOrganization.org_uid },
      raw: true,
    });

    // Prefix keys with "meta_" for datalayer
    const metadata = _.mapKeys(payload, (_value, key) => `meta_${key}`);

    // Update datalayer using V2-specific method
    await OrganizationsV2.upsertDataLayerV2(myOrganization.org_uid, metadata);

    // Update database record - merge with existing metadata
    let existingMetadata = {};
    if (rawOrg?.metadata) {
      try {
        existingMetadata = JSON.parse(rawOrg.metadata);
      } catch (error) {
        loggerV2.warn('[v2]: Failed to parse existing metadata, starting fresh', {
          error: error.message,
        });
        existingMetadata = {};
      }
    }

    // Merge new metadata with existing
    const mergedMetadata = { ...existingMetadata, ...payload };

    // Update database with merged metadata as JSON string
    await OrganizationsV2.update(
      { metadata: JSON.stringify(mergedMetadata) },
      {
        where: { org_uid: myOrganization.org_uid },
      },
    );
  }

  /**
   * Helper to get registry store ID from singleton
   * For V2 system: Only returns v2 registry store ID (v1 fallback removed - pure V1 orgs stay in V1)
   * For upgraded orgs: Returns v2 registry store ID (they have both v1 and v2, but we use v2)
   * @param {string} dataModelVersionStoreId - The singleton store ID
   * @param {string} requiredVersion - Required version ('v2' for V2 system)
   * @returns {Promise<string>} Registry store ID
   * @throws {Error} If v2 registry store ID not found
   */
  static async getRegistryStoreIdFromSingleton(dataModelVersionStoreId, requiredVersion = 'v2') {
    loggerV2.debug(`[v2]: Getting registry store ID from singleton ${dataModelVersionStoreId}, required version: ${requiredVersion}`);

    // Get singleton data - use getStoreDataPromise in simulator mode, getSubscribedStoreData otherwise
    let singletonData = null;

    if (USE_SIMULATOR) {
      // In simulator mode, use getStoreDataPromise directly (no subscription needed)
      const storeData = await getStoreDataPromise(dataModelVersionStoreId);
      if (storeData && storeData.keys_values) {
        const decodedData = decodeDataLayerResponse(storeData);
        singletonData = decodedData.reduce((obj, current) => {
          obj[current.key] = current.value;
          return obj;
        }, {});
      } else {
        throw new Error(`Failed to get singleton data from ${dataModelVersionStoreId} in simulator mode`);
      }
    } else {
      // In production mode, use getSubscribedStoreData with timeout
      const timeout = Date.now() + 600000; // 10 minutes

      while (!singletonData) {
        try {
          singletonData = await datalayer.getSubscribedStoreData(
            dataModelVersionStoreId,
            undefined,
            true, // wait for sync
          );
          break;
        } catch (error) {
          if (Date.now() > timeout) {
            throw new Error(
              `Timeout getting singleton data from ${dataModelVersionStoreId}: ${error.message}`,
            );
          }
          loggerV2.debug(`[v2]: ${error.message}. RETRYING`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }
    }

    // V2 system requires v2 - no fallback to v1
    // Pure V1 organizations should use V1 API, not V2
    if (singletonData[requiredVersion]) {
      loggerV2.debug(`[v2]: Found registry store ID for version ${requiredVersion}: ${singletonData[requiredVersion]}`);
      return singletonData[requiredVersion];
    }

    throw new Error(
      `Failed to get ${requiredVersion} registry store ID from singleton ${dataModelVersionStoreId}. Available keys: ${Object.keys(singletonData).join(', ')}. Pure V1 organizations should use the V1 API.`,
    );
  }

  /**
   * Subscribe to organization stores (orgUid, registry, file store)
   * V2 system: Only subscribes to organizations with v2 data (no v1 fallback)
   * @param {string} orgUid - Organization UID
   * @returns {Promise<{orgUid: string, dataModelVersionStoreId: string, registryStoreId: string}>}
   */
  static async subscribeToOrganization(orgUid) {
    if (orgUid === 'PENDING') {
      loggerV2.info('[v2]: cannot subscribe to a home organization while its pending.');
      throw new Error('Cannot subscribe to PENDING organization');
    }

    loggerV2.debug(`[v2]: Running the organization subscription process on organization ${orgUid}`);

    // Timeout: 10 minutes
    const timeout = Date.now() + 600000;
    const reachedTimeout = () => Date.now() > timeout;
    const onTimeout = (error) => {
      const message = `Reached timeout before subscribing to all required stores. Failure at timeout: ${error.message}`;
      loggerV2.error(`[v2]: ${message}`);
      throw new Error(message);
    };

    // Step 1: Get org store data to find dataModelVersionStoreId
    loggerV2.debug(`[v2]: Determining datamodel version singleton id for org ${orgUid}`);
    let orgStoreData = null;

    if (USE_SIMULATOR) {
      // In simulator mode, use getStoreDataPromise directly
      const storeData = await getStoreDataPromise(orgUid);
      if (storeData && storeData.keys_values) {
        const decodedData = decodeDataLayerResponse(storeData);
        orgStoreData = decodedData.reduce((obj, current) => {
          obj[current.key] = current.value;
          return obj;
        }, {});
      } else {
        throw new Error(`Failed to get org store data from ${orgUid} in simulator mode`);
      }
    } else {
      // In production mode, use getSubscribedStoreData with retry logic
      while (!orgStoreData) {
        try {
          orgStoreData = await datalayer.getSubscribedStoreData(
            orgUid,
            undefined,
            true, // wait for sync
          );
          break;
        } catch (error) {
          if (reachedTimeout()) {
            onTimeout(error);
          }
          loggerV2.debug(`[v2]: ${error.message}. RETRYING`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }
    }

    const dataModelVersionStoreId = orgStoreData.registryId;
    if (!dataModelVersionStoreId) {
      throw new Error(
        `Failed to get registry datamodel version singleton id from orgUid store ${orgUid}. RPC function returned: ${orgStoreData}`,
      );
    }
    loggerV2.debug(
      `[v2]: The registry datamodel version pointer singleton id for organization ${orgUid} is ${dataModelVersionStoreId}`,
    );

    // Step 2: Get registry store ID from singleton (must be v2 - V2 system only)
    loggerV2.debug(`[v2]: Determining registry store singleton id for org ${orgUid}`);
    const registryStoreId = await OrganizationsV2.getRegistryStoreIdFromSingleton(
      dataModelVersionStoreId,
      'v2', // Must be v2 - V2 system only works with V2 organizations
    );
    loggerV2.debug(
      `[v2]: The registry singleton id for organization ${orgUid} is ${registryStoreId}`,
    );

    // Step 3: Subscribe to registry store
    loggerV2.debug(`[v2]: Checking registry store singleton for org ${orgUid}`);
    const subscribedToRegistryStore =
      await datalayer.subscribeToStoreOnDataLayer(registryStoreId);
    // In simulator mode, subscribeToStoreOnDataLayer returns undefined (no-op)
    // In production mode, it returns true/false
    if (!USE_SIMULATOR && !subscribedToRegistryStore) {
      throw new Error(
        `Failed to subscribe to or validate subscription for registry store ${registryStoreId}`,
      );
    }

    // Step 4: Subscribe to file store if enabled
    if (AUTO_SUBSCRIBE_FILESTORE) {
      loggerV2.info(`[v2]: Subscribing to file store for organization ${orgUid}`);
      try {
        await FileStore.subscribeToFileStore(orgUid);
      } catch (error) {
        loggerV2.warn(
          `[v2]: Failed to subscribe to file store. Error: ${error.message}`,
        );
      }
    }

    // Step 5: Mark organization as subscribed in database if it exists
    const organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });
    if (organization) {
      loggerV2.info(`[v2]: Marking existing organization record as subscribed`);
      await OrganizationsV2.update(
        { subscribed: true },
        { where: { org_uid: orgUid } },
      );
    }

    return {
      orgUid,
      dataModelVersionStoreId,
      registryStoreId,
    };
  }

  /**
   * Import organization from datalayer
   * @param {string} orgUid - Organization UID
   * @param {boolean} isHome - Whether this is a home organization
   * @returns {Promise<void>}
   */
  static async importOrganization(orgUid, isHome = false) {
    // Subscribe to the org store first, then check sync status.
    // This ensures new org stores get subscribed on the first pass so they can
    // begin syncing, and subsequent runs will find them synced and proceed.
    if (!USE_SIMULATOR) {
      try {
        // Subscribe to the store if not already subscribed (no-op if already subscribed)
        await datalayer.subscribeToStoreOnDataLayer(orgUid);
      } catch (error) {
        loggerV2.warn(
          `[v2]: Could not subscribe to store for ${orgUid}, skipping import: ${error.message}`,
        );
        return;
      }

      // Check if store is synced BEFORE acquiring mutex to avoid blocking other operations
      // If store is not synced, skip import - it will be retried on next task run
      try {
        const syncStatus = await datalayer.getDataLayerStoreSyncStatus(orgUid);
        if (!isDlStoreSynced(syncStatus?.sync_status)) {
          loggerV2.info(
            `[v2]: Skipping import of organization ${orgUid} - store not yet synced. Will retry on next task run.`,
          );
          return;
        }
      } catch (error) {
        loggerV2.warn(
          `[v2]: Could not check sync status for ${orgUid}, skipping import: ${error.message}`,
        );
        return;
      }
    }

    loggerV2.verbose('[v2]: Acquiring mutex to import organization');
    const releaseMutex = await addOrDeleteOrganizationRecordMutex.acquire();

    try {
      // Validate store ownership if home org (skip in simulator mode)
      if (isHome && !USE_SIMULATOR) {
        try {
          await assertStoreIsOwned(orgUid);
        } catch {
          throw new Error(
            `orgUid store ${orgUid} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
          );
        }
      }

      // Remove from deleted orgs list if present
      const { MetaV2 } = await import('./index.js');
      await MetaV2.destroy({
        where: { meta_key: 'userDeletedOrgUid', meta_value: orgUid },
      });

      loggerV2.info(`[v2]: Importing organization ${orgUid} ${isHome && 'as home'}`);
      loggerV2.debug(
        `[v2]: Running the organization model subscription process on ${orgUid}`,
      );

      // Subscribe to organization stores
      let storeIds = null;
      try {
        storeIds = await OrganizationsV2.subscribeToOrganization(orgUid);
      } catch (error) {
        loggerV2.error(
          `[v2]: Failure validating or adding subscriptions for org import. cannot import. Error: ${error.message}`,
        );
        throw new Error(
          `Failed to subscribe to, or validate subscribed store data for, organization ${orgUid}`,
        );
      }

      // Validate store ownership for home org (skip in simulator mode)
      if (isHome && !USE_SIMULATOR) {
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

      // Get organization data from datalayer
      let orgData;
      let dataModelInfo;

      if (USE_SIMULATOR) {
        // In simulator mode, use getStoreDataPromise directly
        const orgStoreData = await getStoreDataPromise(storeIds.orgUid);
        if (orgStoreData && orgStoreData.keys_values) {
          const decodedOrgData = decodeDataLayerResponse(orgStoreData);
          orgData = decodedOrgData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});
        } else {
          throw new Error(`Failed to get organization data for ${orgUid} in simulator mode`);
        }

        // Get singleton data
        const singletonStoreData = await getStoreDataPromise(storeIds.dataModelVersionStoreId);
        if (singletonStoreData && singletonStoreData.keys_values) {
          const decodedSingletonData = decodeDataLayerResponse(singletonStoreData);
          dataModelInfo = decodedSingletonData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});
        } else {
          throw new Error(
            `Failed to determine datamodel version for organization ${orgUid} in simulator mode`,
          );
        }
      } else {
        // In production mode, use getCurrentStoreData
        orgData = await datalayer.getCurrentStoreData(storeIds.orgUid);
        if (!orgData) {
          throw new Error(`Failed to get organization data for ${orgUid}`);
        }

        dataModelInfo = await datalayer.getCurrentStoreData(
          storeIds.dataModelVersionStoreId,
        );
        if (!dataModelInfo) {
          throw new Error(
            `Failed to determine datamodel version for organization ${orgUid}`,
          );
        }
      }

      // CRITICAL: V2 can only import organizations that have v2 data
      // Pure V1 organizations (singleton only has v1) should stay in V1 system
      // Only upgraded organizations (singleton has both v1 and v2) can be imported
      if (!dataModelInfo.v2) {
        throw new Error(
          `Organization ${orgUid} does not have V2 data. Only V2 organizations (or upgraded organizations with V2 data) can be imported into V2 system. Pure V1 organizations should use the V1 API.`,
        );
      }

      // Get registry store ID (must use v2 - this is a V2 system)
      const registryStoreId = await OrganizationsV2.getRegistryStoreIdFromSingleton(
        storeIds.dataModelVersionStoreId,
        'v2', // Must be v2 for V2 system
      );

      // Create organization record
      const organizationData = {
        org_uid: orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registry_id: registryStoreId,
        data_model_version_store_id: storeIds.dataModelVersionStoreId,
        file_store_subscribed: orgData?.fileStoreId || null,
        subscribed: true,
        is_home: isHome,
      };
      loggerV2.info(
        `[v2]: Adding organization with the following info: ${JSON.stringify(organizationData)}`,
      );

      await OrganizationsV2.create(organizationData);
    } catch (error) {
      throw new Error(error.message);
    } finally {
      releaseMutex();
    }
  }

  /**
   * Unsubscribe from organization stores
   * @param {Object} organization - Organization record
   * @param {string} organization.org_uid - Organization UID
   * @param {string} organization.data_model_version_store_id - Data model version store ID
   * @param {string} organization.registry_id - Registry store ID
   * @returns {Promise<void>}
   */
  static async unsubscribeFromOrganizationStores(organization) {
    const { storeIds: subscriptionIds, success } = await getSubscriptions();
    if (!success) {
      throw new Error('Failed to get subscriptions from datalayer');
    }

    const storesToUnsubscribe = [
      organization.org_uid,
      organization.data_model_version_store_id,
      organization.registry_id,
    ];
    const failedUnsubscribes = [];

    storesToUnsubscribe.forEach((storeId) => {
      if (!storeId) {
        const message = `Organization stores cannot be nil. found nil store id associated with organization ${organization.org_uid}`;
        loggerV2.error(`[v2]: ${message}`);
        throw new Error(message);
      }
    });

    for (const storeId of storesToUnsubscribe) {
      if (subscriptionIds.includes(storeId)) {
        try {
          await datalayer.unsubscribeFromDataLayerStoreWithRetry(storeId);
          loggerV2.info(`[v2]: Successfully unsubscribed from store ${storeId}`);
        } catch (error) {
          loggerV2.error(
            `[v2]: unsubscribeFromOrganizationStores() encountered an error: ${error.message}`,
          );
          failedUnsubscribes.push(storeId);
        }
      }
    }

    if (failedUnsubscribes.length) {
      const message = `Failed to unsubscribe from the following organization stores: ${failedUnsubscribes.join(', ')}`;
      loggerV2.error(`[v2]: ${message}`);
      throw new Error(message);
    }

    // Mark organization as unsubscribed in database
    const orgExistsInDb = await OrganizationsV2.findOne({
      where: { org_uid: organization.org_uid },
      raw: true,
    });

    if (orgExistsInDb) {
      await OrganizationsV2.update(
        { subscribed: false },
        { where: { org_uid: organization.org_uid } },
      );
    }
  }

  /**
   * Reconcile organization - validate and update database with datalayer data
   * @param {Object} organization - Organization record
   * @returns {Promise<void>}
   */
  static async reconcileOrganization(organization) {
    const { org_uid, is_home } = organization;

    loggerV2.info(`[v2]: Reconciling organization ${org_uid}`);

    // Validate store ownership if home org (skip in simulator mode)
    if (is_home && !USE_SIMULATOR) {
      try {
        await assertStoreIsOwned(org_uid);
      } catch {
        throw new Error(
          `orgUid store ${org_uid} is not owned by this chia wallet. cannot reconcile home organization`,
        );
      }
    }

    // Subscribe to organization (this will update subscriptions if needed)
    const storeIds = await OrganizationsV2.subscribeToOrganization(org_uid);

    // Get current data from datalayer
    let orgData;
    if (USE_SIMULATOR) {
      // In simulator mode, use getStoreDataPromise directly
      const storeData = await getStoreDataPromise(org_uid);
      if (storeData && storeData.keys_values) {
        const decodedData = decodeDataLayerResponse(storeData);
        orgData = decodedData.reduce((obj, current) => {
          obj[current.key] = current.value;
          return obj;
        }, {});
      } else {
        throw new Error(`Failed to get organization data for ${org_uid} in simulator mode`);
      }
    } else {
      // In production mode, use getCurrentStoreData
      orgData = await datalayer.getCurrentStoreData(org_uid);
      if (!orgData) {
        throw new Error(`Failed to get organization data for ${org_uid}`);
      }
    }

    // Get registry store ID from singleton (must be v2 - V2 system only)
    const registryStoreId = await OrganizationsV2.getRegistryStoreIdFromSingleton(
      storeIds.dataModelVersionStoreId,
      'v2', // Must be v2 - V2 system only works with V2 organizations
    );

    // Compare datalayer data with database
    const updates = {};
    let needsUpdate = false;

    if (organization.name !== orgData.name) {
      updates.name = orgData.name;
      needsUpdate = true;
    }

    if (organization.icon !== orgData.icon) {
      updates.icon = orgData.icon;
      needsUpdate = true;
    }

    if (organization.registry_id !== registryStoreId) {
      updates.registry_id = registryStoreId;
      needsUpdate = true;
    }

    if (organization.data_model_version_store_id !== storeIds.dataModelVersionStoreId) {
      updates.data_model_version_store_id = storeIds.dataModelVersionStoreId;
      needsUpdate = true;
    }

    if (organization.file_store_subscribed !== (orgData?.fileStoreId || null)) {
      updates.file_store_subscribed = orgData?.fileStoreId || null;
      needsUpdate = true;
    }

    // Update data_model_version_store_hash if store is synced
    // Skip in simulator mode as there's no real datalayer
    if (!USE_SIMULATOR) {
      const dataModelVersionStoreSyncStatus = await datalayer.getDataLayerStoreSyncStatus(
        storeIds.dataModelVersionStoreId,
      );

      if (isDlStoreSynced(dataModelVersionStoreSyncStatus?.sync_status)) {
        const { confirmed, hash } = await getRoot(storeIds.dataModelVersionStoreId);
        if (confirmed && hash !== organization.data_model_version_store_hash) {
          loggerV2.info(
            `[v2]: data model version store ${storeIds.dataModelVersionStoreId} root hash needs to be updated ` +
              `from ${organization.data_model_version_store_hash} to ${hash}`,
          );
          updates.data_model_version_store_hash = hash;
          needsUpdate = true;
        } else if (!confirmed) {
          loggerV2.warn(
            `[v2]: data model version store ${storeIds.dataModelVersionStoreId} has not been confirmed yet. cannot validate or update hash.`,
          );
        }
      }

      // Update registry_hash if registry store is synced
      const registrySyncStatus = await datalayer.getDataLayerStoreSyncStatus(registryStoreId);

      if (isDlStoreSynced(registrySyncStatus?.sync_status)) {
        const { confirmed, hash } = await getRoot(registryStoreId);
        if (confirmed && hash !== organization.registry_hash) {
          loggerV2.info(
            `[v2]: registry store ${registryStoreId} root hash needs to be updated ` +
              `from ${organization.registry_hash} to ${hash}`,
          );
          updates.registry_hash = hash;
          needsUpdate = true;
        } else if (!confirmed) {
          loggerV2.warn(
            `[v2]: registry store ${registryStoreId} has not been confirmed yet. cannot validate or update hash.`,
          );
        }
      }
    }

    // Update database if discrepancies found
    if (needsUpdate) {
      loggerV2.info(`[v2]: Updating organization ${org_uid} with datalayer data`);
      await OrganizationsV2.update(updates, {
        where: { org_uid },
      });
    } else {
      loggerV2.debug(`[v2]: Organization ${org_uid} is in sync with datalayer`);
    }
  }

  /**
   * Delete all V2 data for an organization
   * @param {string} orgUid - Organization UID
   * @returns {Promise<void>}
   */
  static async deleteAllOrganizationData(orgUid, retryCount = 0) {
    const maxRetries = 10;
    const baseDelay = 200; // 200ms base delay
    const maxDelay = 5000; // 5 seconds max delay

    loggerV2.verbose('[v2]: acquiring add/delete org mutex to delete organization');
    const releaseAddDeleteMutex =
      await addOrDeleteOrganizationRecordMutex.acquire();

    loggerV2.verbose(
      '[v2]: acquiring processingSyncRegistriesTransactionV2 mutex to delete organization',
    );
    const releaseAuditTransactionMutex =
      await processingSyncRegistriesTransactionMutexV2.acquire();

    const transaction = await sequelizeV2.transaction();
    try {
      // Import V2 models
      const { MetaV2, AuditV2 } = await import('./index.js');

      // Delete from organization table
      await OrganizationsV2.destroy({
        where: { org_uid: orgUid },
        transaction,
      });

      // Note: StagingV2 doesn't have org_uid, so we can't delete org-specific staging records
      // Staging is temporary and will be cleared on next commit cycle
      // We skip truncating staging here to avoid database locks

      // Delete from audit table (only V2 data model with org_uid)
      await AuditV2.destroy({
        where: { org_uid: orgUid },
        transaction,
      });

      // Delete from meta table (org-related metadata)
      // Note: This delete might not match anything if the record doesn't exist
      // We delete it here to clean up, but the main logic below handles create/update
      await MetaV2.destroy({
        where: { meta_key: 'userDeletedOrgUid', meta_value: orgUid },
        transaction,
      });

      // Note: V2 data models (ProgramV2, ProjectV2, etc.) don't have org_uid fields
      // They are associated with organizations through the registry, not directly.
      // Data model records are shared across organizations that use the same registry.
      // Therefore, we only delete from system tables (AuditV2, StagingV2, MetaV2) and the organization itself.

      // Add to deleted orgs list (before commit so it's part of transaction)
      // Use upsert instead of findOne + create/update to avoid unique constraint lock issues
      // First, try to find existing record to get current value
      const existingMeta = await MetaV2.findOne({
        where: { meta_key: 'userDeletedOrgUid' },
        transaction,
      });

      let deletedOrgs = [];
      if (existingMeta) {
        // Parse existing value and add orgUid if not already present
        try {
          deletedOrgs = JSON.parse(existingMeta.meta_value || '[]');
        } catch {
          deletedOrgs = [];
        }
      }

      if (!deletedOrgs.includes(orgUid)) {
        deletedOrgs.push(orgUid);
        // Use upsert to handle both create and update cases atomically
        // This avoids unique constraint lock issues
        await MetaV2.upsert({
          meta_key: 'userDeletedOrgUid',
          meta_value: JSON.stringify(deletedOrgs),
        }, {
          transaction,
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();

      // Check if it's a database lock error and we haven't exceeded max retries
      // Check both error.message and error.original (Sequelize wraps errors)
      const errorMessage = error.message || '';
      const originalError = error.original || error.parent || {};
      const originalMessage = originalError.message || '';
      const errorCode = error.code || originalError.code || '';

      const isDatabaseLockError =
        errorMessage.includes('SQLITE_BUSY') ||
        errorMessage.includes('database is locked') ||
        originalMessage.includes('SQLITE_BUSY') ||
        originalMessage.includes('database is locked') ||
        errorCode === 'SQLITE_BUSY' ||
        originalError.code === 'SQLITE_BUSY';

      if (isDatabaseLockError && retryCount < maxRetries) {
        // Calculate exponential backoff delay
        const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
        loggerV2.info(
          `[v2]: Database lock detected for deleteAllOrganizationData (attempt ${retryCount + 1}/${maxRetries}). Retrying in ${delay}ms...`,
        );

        // Release mutexes before retry
        releaseAddDeleteMutex();
        releaseAuditTransactionMutex();

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Retry the operation
        return await OrganizationsV2.deleteAllOrganizationData(
          orgUid,
          retryCount + 1,
        );
      }

      // If not a lock error or max retries exceeded, throw the error
      loggerV2.error(
        `[v2]: failed to delete all db records for organization ${orgUid}, rolling back changes. Error: ${error.message}`,
      );
      releaseAddDeleteMutex();
      releaseAuditTransactionMutex();
      throw new Error(
        `an error occurred while deleting records corresponding to organization ${orgUid}. no changes have been made`,
      );
    }
    // Success case - release mutexes
    releaseAddDeleteMutex();
    releaseAuditTransactionMutex();
  }

  /**
   * Synchronizes metadata for all subscribed organizations
   * @returns {Promise<void>}
   */
  static async syncOrganizationMeta() {
    try {
      const allSubscribedOrganizations = await OrganizationsV2.findAll({
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
          loggerV2.info(`[v2]: Unable to sync metadata from ${organization.org_uid}`);
          loggerV2.error(`[v2]: ORGANIZATION DATA SYNC ERROR: ${message}`);
          await OrganizationsV2.update(
            { org_hash: '0' },
            { where: { org_uid: organization.org_uid } },
          );
        };

        const onResult = async (updateHash, data) => {
          try {
            const updateData = processData(
              data,
              (key) => !key.includes('meta_'),
            );
            const metadata = processData(data, (key) => key.includes('meta_'));

            // Convert metadata object to JSON string
            const metadataJson = Object.keys(metadata).length > 0
              ? JSON.stringify(metadata)
              : '{}';

            await OrganizationsV2.update(
              {
                ..._.omit(updateData, [
                  'registry_id',
                  'data_model_version_store_id',
                ]),
                metadata: metadataJson,
              },
              { where: { org_uid: organization.org_uid } },
            );

            loggerV2.debug(
              `[v2]: Updating orgUid ${organization.org_uid} with hash ${updateHash}`,
            );
            await OrganizationsV2.update(
              { org_hash: updateHash },
              { where: { org_uid: organization.org_uid } },
            );
          } catch (error) {
            loggerV2.info(`[v2]: ${error.message}`);
            onFail(error.message);
          }
        };

        // Use datalayer.getStoreIfUpdated (from syncService)
        await datalayer.getStoreIfUpdated(
          organization.org_uid,
          organization.org_hash || '0',
          onResult,
          onFail,
        );
      }
    } catch (error) {
      loggerV2.error(`[v2]: Error in syncOrganizationMeta: ${error.message}`);
    }
  }

  /**
   * Add mirror for a store
   * @param {string} storeId - Store ID
   * @param {string} url - Mirror URL
   * @param {boolean} force - Force add mirror even without home org
   * @returns {Promise<boolean>} Success status
   */
  static async addMirror(storeId, url, force = false) {
    return await datalayer.addMirror(storeId, url, force);
  }

  /**
   * Remove mirror for a store
   * @param {string} storeId - Store ID
   * @param {string} coinId - Coin ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeMirror(storeId, coinId) {
    return await datalayer.removeMirror(storeId, coinId);
  }
}

OrganizationsV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'OrganizationsV2',
  tableName: 'organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default OrganizationsV2;
