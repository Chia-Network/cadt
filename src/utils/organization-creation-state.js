/**
 * Organization Creation State Machine
 *
 * This module manages the state of parallel organization creation,
 * enabling crash recovery and status tracking.
 *
 * States:
 * - INITIALIZING: Starting creation, saving initial parameters
 * - STORES_CREATING: Creating stores in parallel
 * - STORES_CONFIRMED: All stores created and confirmed on blockchain
 * - DATA_PUSHING: Pushing data to stores in parallel
 * - FINALIZING: Updating database with final org record
 * - COMPLETE: Organization creation finished successfully
 * - FAILED: Organization creation failed after max retries
 */

import { logger, loggerV2 } from '../config/logger.js';

// State constants
export const ORG_CREATION_STATES = {
  INITIALIZING: 'INITIALIZING',
  STORES_CREATING: 'STORES_CREATING',
  STORES_CONFIRMED: 'STORES_CONFIRMED',
  DATA_PUSHING: 'DATA_PUSHING',
  FINALIZING: 'FINALIZING',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
};

// Store types
export const STORE_TYPES = {
  ORG_UID: 'orgUid',
  REGISTRY: 'registry',
  DATA_MODEL_VERSION: 'dataModelVersion',
  FILE_STORE: 'fileStore',
};

// Configuration
export const ORG_CREATION_CONFIG = {
  MAX_RETRIES: 3,
  STORE_CONFIRMATION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  CONFIRMATION_POLL_INTERVAL_MS: 30 * 1000, // 30 seconds
  META_KEY: 'pendingOrgCreation',
};

/**
 * Creates an initial state object for organization creation
 * @param {string} name - Organization name
 * @param {string} icon - Organization icon
 * @param {string} dataVersion - Data version (v1 or v2)
 * @param {string} apiVersion - API version ('v1' or 'v2')
 * @returns {Object} Initial state object
 */
export const createInitialState = (name, icon, dataVersion, apiVersion = 'v2') => {
  const now = new Date().toISOString();
  return {
    state: ORG_CREATION_STATES.INITIALIZING,
    apiVersion,
    name,
    icon: icon || '',
    dataVersion,
    retryCount: 0,
    stores: {
      [STORE_TYPES.ORG_UID]: { id: null, confirmed: false, dataWritten: false },
      [STORE_TYPES.REGISTRY]: { id: null, confirmed: false, dataWritten: false },
      [STORE_TYPES.DATA_MODEL_VERSION]: { id: null, confirmed: false, dataWritten: false },
      [STORE_TYPES.FILE_STORE]: { id: null, confirmed: false, dataWritten: false },
    },
    error: null,
    startedAt: now,
    updatedAt: now,
  };
};

/**
 * Updates the state and timestamp
 * @param {Object} currentState - Current state object
 * @param {Object} updates - Updates to apply
 * @returns {Object} Updated state object
 */
export const updateState = (currentState, updates) => {
  return {
    ...currentState,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Marks a store as created with its ID
 * @param {Object} currentState - Current state object
 * @param {string} storeType - Type of store (from STORE_TYPES)
 * @param {string} storeId - The store ID from datalayer
 * @returns {Object} Updated state object
 */
export const markStoreCreated = (currentState, storeType, storeId) => {
  const updatedStores = {
    ...currentState.stores,
    [storeType]: {
      ...currentState.stores[storeType],
      id: storeId,
    },
  };
  return updateState(currentState, { stores: updatedStores });
};

/**
 * Marks a store as confirmed on the blockchain
 * @param {Object} currentState - Current state object
 * @param {string} storeType - Type of store (from STORE_TYPES)
 * @returns {Object} Updated state object
 */
export const markStoreConfirmed = (currentState, storeType) => {
  const updatedStores = {
    ...currentState.stores,
    [storeType]: {
      ...currentState.stores[storeType],
      confirmed: true,
    },
  };
  return updateState(currentState, { stores: updatedStores });
};

/**
 * Marks a store's data as written
 * @param {Object} currentState - Current state object
 * @param {string} storeType - Type of store (from STORE_TYPES)
 * @returns {Object} Updated state object
 */
export const markStoreDataWritten = (currentState, storeType) => {
  const updatedStores = {
    ...currentState.stores,
    [storeType]: {
      ...currentState.stores[storeType],
      dataWritten: true,
    },
  };
  return updateState(currentState, { stores: updatedStores });
};

/**
 * Checks if all stores have been created (have IDs)
 * @param {Object} state - Current state object
 * @returns {boolean}
 */
export const allStoresCreated = (state) => {
  return Object.values(state.stores).every((store) => store.id !== null);
};

/**
 * Checks if all stores are confirmed on the blockchain
 * @param {Object} state - Current state object
 * @returns {boolean}
 */
export const allStoresConfirmed = (state) => {
  return Object.values(state.stores).every((store) => store.confirmed);
};

/**
 * Checks if all required data has been written to stores
 * For org creation, only orgUid and dataModelVersion stores need data
 * @param {Object} state - Current state object
 * @returns {boolean}
 */
export const allDataWritten = (state) => {
  return (
    state.stores[STORE_TYPES.ORG_UID].dataWritten &&
    state.stores[STORE_TYPES.DATA_MODEL_VERSION].dataWritten
  );
};

/**
 * Gets stores that still need to be created
 * @param {Object} state - Current state object
 * @returns {string[]} Array of store types that need creation
 */
export const getStoresToCreate = (state) => {
  return Object.entries(state.stores)
    .filter(([_, store]) => store.id === null)
    .map(([type]) => type);
};

/**
 * Gets stores that are created but not yet confirmed
 * @param {Object} state - Current state object
 * @returns {string[]} Array of store types awaiting confirmation
 */
export const getStoresAwaitingConfirmation = (state) => {
  return Object.entries(state.stores)
    .filter(([_, store]) => store.id !== null && !store.confirmed)
    .map(([type]) => type);
};

/**
 * Gets stores that need data written
 * @param {Object} state - Current state object
 * @returns {string[]} Array of store types needing data
 */
export const getStoresNeedingData = (state) => {
  // Only orgUid and dataModelVersion stores need data written
  const storesNeedingData = [STORE_TYPES.ORG_UID, STORE_TYPES.DATA_MODEL_VERSION];
  return storesNeedingData.filter(
    (type) => state.stores[type].confirmed && !state.stores[type].dataWritten,
  );
};

/**
 * Checks if the creation process has timed out
 * @param {Object} state - Current state object
 * @returns {boolean}
 */
export const hasTimedOut = (state) => {
  const startTime = new Date(state.startedAt).getTime();
  const elapsed = Date.now() - startTime;
  return elapsed > ORG_CREATION_CONFIG.STORE_CONFIRMATION_TIMEOUT_MS;
};

/**
 * Increments the retry count
 * @param {Object} currentState - Current state object
 * @returns {Object} Updated state object
 */
export const incrementRetryCount = (currentState) => {
  return updateState(currentState, { retryCount: currentState.retryCount + 1 });
};

/**
 * Checks if max retries have been exceeded
 * @param {Object} state - Current state object
 * @returns {boolean}
 */
export const hasExceededMaxRetries = (state) => {
  return state.retryCount >= ORG_CREATION_CONFIG.MAX_RETRIES;
};

/**
 * Marks the creation as failed
 * @param {Object} currentState - Current state object
 * @param {string} errorMessage - Error message
 * @returns {Object} Updated state object
 */
export const markAsFailed = (currentState, errorMessage) => {
  return updateState(currentState, {
    state: ORG_CREATION_STATES.FAILED,
    error: errorMessage,
  });
};

/**
 * Gets a human-readable status summary
 * @param {Object} state - Current state object
 * @returns {Object} Status summary
 */
export const getStatusSummary = (state) => {
  if (!state) {
    return {
      inProgress: false,
      state: null,
      message: 'No organization creation in progress',
    };
  }

  const storesCreated = Object.values(state.stores).filter((s) => s.id !== null).length;
  const storesConfirmed = Object.values(state.stores).filter((s) => s.confirmed).length;
  const dataWritten = Object.values(state.stores).filter((s) => s.dataWritten).length;

  let message;
  let progress;

  switch (state.state) {
    case ORG_CREATION_STATES.INITIALIZING:
      message = 'Initializing organization creation';
      progress = 0;
      break;
    case ORG_CREATION_STATES.STORES_CREATING:
      message = `Creating stores on blockchain (${storesCreated}/4 created, ${storesConfirmed}/4 confirmed)`;
      progress = Math.round((storesConfirmed / 4) * 50);
      break;
    case ORG_CREATION_STATES.STORES_CONFIRMED:
      message = 'All stores confirmed, preparing to write data';
      progress = 50;
      break;
    case ORG_CREATION_STATES.DATA_PUSHING:
      message = `Writing organization data (${dataWritten}/2 stores updated)`;
      progress = 50 + Math.round((dataWritten / 2) * 40);
      break;
    case ORG_CREATION_STATES.FINALIZING:
      message = 'Finalizing organization record';
      progress = 95;
      break;
    case ORG_CREATION_STATES.COMPLETE:
      message = 'Organization creation complete';
      progress = 100;
      break;
    case ORG_CREATION_STATES.FAILED:
      message = `Organization creation failed: ${state.error}`;
      progress = -1;
      break;
    default:
      message = 'Unknown state';
      progress = -1;
  }

  return {
    inProgress: ![ORG_CREATION_STATES.COMPLETE, ORG_CREATION_STATES.FAILED].includes(state.state),
    state: state.state,
    message,
    progress,
    retryCount: state.retryCount,
    maxRetries: ORG_CREATION_CONFIG.MAX_RETRIES,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    stores: {
      orgUid: state.stores[STORE_TYPES.ORG_UID],
      registry: state.stores[STORE_TYPES.REGISTRY],
      dataModelVersion: state.stores[STORE_TYPES.DATA_MODEL_VERSION],
      fileStore: state.stores[STORE_TYPES.FILE_STORE],
    },
    error: state.error,
  };
};

/**
 * Logs state information using the appropriate logger
 * @param {Object} state - Current state object
 * @param {string} message - Log message
 * @param {string} level - Log level (info, debug, error, etc.)
 */
export const logState = (state, message, level = 'info') => {
  const log = state?.apiVersion === 'v2' ? loggerV2 : logger;
  const prefix = state?.apiVersion === 'v2' ? '[v2]' : '[v1]';
  log[level](`${prefix}: [OrgCreation] ${message}`);
};

// ============================================================================
// State Persistence Functions
// ============================================================================

/**
 * Saves the organization creation state to the Meta table
 * @param {Object} state - State object to save
 * @param {Object} MetaModel - The Meta model to use (Meta or MetaV2)
 * @returns {Promise<void>}
 */
export const saveCreationState = async (state, MetaModel) => {
  const metaKey = ORG_CREATION_CONFIG.META_KEY;
  const stateJson = JSON.stringify(state);

  // Determine field names based on state's apiVersion (V1 uses camelCase, V2 uses snake_case)
  const isV2 = state.apiVersion === 'v2';
  const keyField = isV2 ? 'meta_key' : 'metaKey';
  const valueField = isV2 ? 'meta_value' : 'metaValue';

  const existing = await MetaModel.findOne({
    where: { [keyField]: metaKey },
    raw: true,
  });

  if (existing) {
    await MetaModel.update(
      { [valueField]: stateJson },
      { where: { [keyField]: metaKey } },
    );
  } else {
    await MetaModel.create({
      [keyField]: metaKey,
      [valueField]: stateJson,
    });
  }

  logState(state, `State saved: ${state.state}`, 'debug');
};

/**
 * Loads the organization creation state from the Meta table
 * @param {Object} MetaModel - The Meta model to use (Meta or MetaV2)
 * @param {string} apiVersion - 'v1' or 'v2'
 * @returns {Promise<Object|null>} The state object or null if not found
 */
export const loadCreationState = async (MetaModel, apiVersion) => {
  const metaKey = ORG_CREATION_CONFIG.META_KEY;
  const isV2 = apiVersion === 'v2';
  const keyField = isV2 ? 'meta_key' : 'metaKey';
  const valueField = isV2 ? 'meta_value' : 'metaValue';

  const existing = await MetaModel.findOne({
    where: { [keyField]: metaKey },
    raw: true,
  });

  if (!existing || !existing[valueField]) {
    return null;
  }

  try {
    const state = JSON.parse(existing[valueField]);
    return state;
  } catch (error) {
    const log = apiVersion === 'v2' ? loggerV2 : logger;
    log.error(`[${apiVersion}]: [OrgCreation] Failed to parse saved state: ${error.message}`);
    return null;
  }
};

/**
 * Clears the organization creation state from the Meta table
 * @param {Object} MetaModel - The Meta model to use (Meta or MetaV2)
 * @param {string} apiVersion - 'v1' or 'v2'
 * @returns {Promise<void>}
 */
export const clearCreationState = async (MetaModel, apiVersion) => {
  const metaKey = ORG_CREATION_CONFIG.META_KEY;
  const isV2 = apiVersion === 'v2';
  const keyField = isV2 ? 'meta_key' : 'metaKey';

  await MetaModel.destroy({
    where: { [keyField]: metaKey },
  });

  const log = apiVersion === 'v2' ? loggerV2 : logger;
  log.info(`[${apiVersion}]: [OrgCreation] Creation state cleared`);
};

/**
 * Checks if there's an in-progress organization creation.
 *
 * A creation is considered "in progress" only if it is in a non-terminal state
 * AND has not timed out.  Timed-out states are treated as stale so the caller
 * (controller) does not permanently block new creation attempts when the
 * background task failed to mark the state as FAILED.  Letting the request
 * through allows the model's resume logic to handle timeout/retry properly.
 *
 * @param {Object} MetaModel - The Meta model to use (Meta or MetaV2)
 * @param {string} apiVersion - 'v1' or 'v2'
 * @returns {Promise<boolean>}
 */
export const hasInProgressCreation = async (MetaModel, apiVersion) => {
  const state = await loadCreationState(MetaModel, apiVersion);
  if (!state) {
    return false;
  }
  if ([ORG_CREATION_STATES.COMPLETE, ORG_CREATION_STATES.FAILED].includes(state.state)) {
    return false;
  }
  if (hasTimedOut(state)) {
    const log = apiVersion === 'v2' ? loggerV2 : logger;
    log.info(
      `[${apiVersion}]: [OrgCreation] Stale creation detected (state=${state.state}, ` +
      `started=${state.startedAt}, retries=${state.retryCount}). ` +
      'Allowing new creation attempt to trigger resume/retry logic.',
    );
    return false;
  }
  return true;
};
