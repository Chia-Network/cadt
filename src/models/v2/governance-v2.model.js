'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2 } from '../../database/v2/index.js';
import { MetaV2 } from '../v2/index.js';
import { Meta } from '../../models/index.js';
import datalayer from '../../datalayer/index.js';
import { getConfig, getConfigV2 } from '../../utils/config-loader.js';
import { loggerV2 } from '../../config/logger.js';
import { keyValueToChangeList, isDlStoreSynced } from '../../utils/datalayer-utils.js';
import {
  assertStoreIsOwned,
  assertOwnedStoreLocalDataIntact,
} from '../../utils/data-assertions.js';
import PickListStub from '../governance/governance-v2.stub.js';

import ModelTypes from './governance-v2.modeltypes.js';

class GovernanceV2 extends Model {
  static async create(values, options) {
    const result = await super.create(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    const result = await super.bulkCreate(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    const result = await super.update(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Upsert governance data downloaded from a governance body store
   * Parses governanceData for orgList, glossary, pickList and upserts into GovernanceV2
   *
   * @param {string} sourceGovernanceBodyId - The governance body store ID
   * @param {Object} governanceData - The governance data object containing orgList, glossary, pickList
   * @throws {Error} If governanceData is null or falsy
   */
  static async upsertGovernanceDownload(
    sourceGovernanceBodyId,
    governanceData,
  ) {
    if (!governanceData) {
      throw new Error(
        'upsertGovernanceDownload() received a nil or falsy governance data value',
      );
    }

    const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;
    const updates = [];

    if (governanceData.orgList) {
      updates.push({
        meta_key: 'orgList',
        meta_value: governanceData.orgList,
        confirmed: true,
      });
    } else {
      loggerV2.warn(
        `[v2]: governance data in store ${sourceGovernanceBodyId} does not contain orgList values`,
      );
    }

    if (governanceData.glossary) {
      updates.push({
        meta_key: 'glossary',
        meta_value: governanceData.glossary,
        confirmed: true,
      });
    } else {
      loggerV2.warn(
        `[v2]: governance data in store ${sourceGovernanceBodyId} does not contain glossary values`,
      );
    }

    if (governanceData.pickList) {
      updates.push({
        meta_key: 'pickList',
        meta_value: governanceData.pickList,
        confirmed: true,
      });
    } else if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
      // Fallback if the app gets through the upstream checks
      loggerV2.info('[v2]: SIMULATOR/DEVELOPMENT MODE: Using sample picklist');
      updates.push({
        meta_key: 'pickList',
        meta_value: JSON.stringify(PickListStub),
        confirmed: true,
      });
    } else {
      loggerV2.warn(
        `[v2]: governance data in store ${sourceGovernanceBodyId} does not contain picklist values`,
      );
    }

    // Compare incoming values against existing rows to detect actual changes
    let changed = false;
    for (const update of updates) {
      const existing = await GovernanceV2.findOne({
        where: { meta_key: update.meta_key },
        raw: true,
      });
      if (!existing || existing.meta_value !== update.meta_value) {
        changed = true;
        break;
      }
    }

    loggerV2.debug('[v2]: upserting governance data from governance body store');
    await Promise.all(updates.map(async (update) => GovernanceV2.upsert(update)));
    return { changed };
  }

  static _lastHeartbeat = 0;

  static _emitHeartbeat(stage, storeId, syncStatus) {
    const now = Date.now();
    if (now - GovernanceV2._lastHeartbeat < 60_000) return;
    GovernanceV2._lastHeartbeat = now;
    const statusStr = syncStatus
      ? ` (generation ${syncStatus.generation ?? '?'}/${syncStatus.target_generation ?? '?'})`
      : '';
    loggerV2.info(
      `[v2]: CADT is waiting for DataLayer to sync governance data: ${stage} store ${storeId}${statusStr}. Next check within 30s.`,
    );
  }

  /**
   * Add V2 support to an existing V1 governance body
   * This method allows an existing V1 governance node to add V2 support without creating a new governance body
   *
   * @returns {Promise<string>} The V2 governance version store ID
   * @throws {Error} If V2 already exists or no V1 governance body found
   */
  static async addV2ToExistingGovernanceBody() {
    const { USE_SIMULATOR } = getConfig().APP;
    const dataModelVersion = 'v2'; // CRITICAL: Hardcode 'v2', not getDataModelVersion()

    // Get existing main governance body ID from Meta (V1)
    const existingV1Governance = await Meta.findOne({
      where: { metaKey: 'mainGoveranceBodyId' },
    });

    if (!existingV1Governance) {
      throw new Error(
        'No existing V1 governance body found. Cannot add V2 support.',
      );
    }

    const mainGovernanceBodyId = existingV1Governance.metaValue;
    loggerV2.info(
      `[v2]: Found existing V1 governance body: ${mainGovernanceBodyId}. Adding V2 support...`,
    );

    // Get current version mapping from main governance body store
    let currentVersionMapping;
    try {
      currentVersionMapping = await datalayer.getSubscribedStoreData(
        mainGovernanceBodyId,
        undefined,
        false, // Don't wait for sync since we're just reading
      );
    } catch (error) {
      // If store doesn't exist or can't be read, treat as empty
      loggerV2.warn(
        `[v2]: Could not read current version mapping from store ${mainGovernanceBodyId}: ${error.message}`,
      );
      currentVersionMapping = {};
    }

    // Verify V2 doesn't already exist in mapping
    if (currentVersionMapping[dataModelVersion]) {
      throw new Error(
        `V2 governance already exists in mapping. Store ID: ${currentVersionMapping[dataModelVersion]}`,
      );
    }

    // Create new V2-specific governance store
    await datalayer.waitForSpendableCoins(1);
    const governanceVersionId = await datalayer.createDataLayerStoreWithRetry();
    loggerV2.info(`[v2]: Created new V2 governance store: ${governanceVersionId}`);

    // Only insert the new version key; existing keys (e.g. v1) are already in the store.
    // syncDataLayer uses 'insert' which fails with KeyAlreadyPresentError for existing keys.
    const newVersionEntry = {
      [dataModelVersion]: governanceVersionId,
    };

    loggerV2.info(
      `[v2]: Adding version mapping to governance store: ${JSON.stringify(newVersionEntry)} (existing: ${JSON.stringify(currentVersionMapping)})`,
    );

    // Update main governance body store with the new version key only
    const revertIfFailed = async () => {
      loggerV2.warn('[v2]: Reverting Failed V2 Governance Body Addition');
      await MetaV2.destroy({ where: { meta_key: 'governanceBodyId' } });
    };

    await datalayer.syncDataLayer(
      mainGovernanceBodyId,
      newVersionEntry,
      revertIfFailed,
    );

    const onConfirm = async () => {
      await MetaV2.upsert({
        meta_key: 'governanceBodyId',
        meta_value: governanceVersionId,
      });
      await MetaV2.upsert({
        meta_key: 'mainGoveranceBodyId',
        meta_value: mainGovernanceBodyId,
      });
      loggerV2.info(
        '[v2]: V2 governance support added to existing V1 governance body. You are ready to go',
      );
    };

    if (!USE_SIMULATOR) {
      loggerV2.info('[v2]: Waiting for V2 governance mapping to be confirmed');
      datalayer.getStoreData(
        mainGovernanceBodyId,
        onConfirm,
        revertIfFailed,
      );
    } else {
      await onConfirm();
    }

    return governanceVersionId;
  }

  /**
   * Create a new governance body for V2
   * Creates main governance body store and V2-specific store
   *
   * @returns {Promise<string>} The V2 governance version store ID
   * @throws {Error} If already listening to another governance body or if V1 governance exists
   */
  static async _setCreationStatus(status, error = null) {
    try {
      await MetaV2.upsert({ meta_key: 'governanceCreationStatus', meta_value: status });
      await MetaV2.upsert({ meta_key: 'governanceCreationStartedAt', meta_value: GovernanceV2._creationStartedAt || new Date().toISOString() });
      if (error) {
        await MetaV2.upsert({ meta_key: 'governanceCreationError', meta_value: String(error) });
      } else {
        await MetaV2.destroy({ where: { meta_key: 'governanceCreationError' } });
      }
    } catch (e) {
      loggerV2.error(`[v2]: Failed to update governance creation status: ${e.message}`);
    }
  }

  static async createGoveranceBody() {
    const { GOVERNANCE_BODY_ID } = getConfigV2().GOVERNANCE;
    const { USE_SIMULATOR } = getConfig().APP;

    if (GOVERNANCE_BODY_ID && GOVERNANCE_BODY_ID !== '') {
      throw new Error(
        'You are already listening to another governance body. Please clear GOVERNANCE_BODY_ID from your V2 config and try again',
      );
    }

    GovernanceV2._creationStartedAt = new Date().toISOString();
    await GovernanceV2._setCreationStatus('creating_stores');

    // Check if this node is already a V1 governance body
    try {
      const existingV1Governance = await Meta.findOne({
        where: { metaKey: 'mainGoveranceBodyId' },
      });

      if (existingV1Governance) {
        loggerV2.info('[v2]: Existing V1 governance body detected, adding V2 support...');
        const result = await GovernanceV2.addV2ToExistingGovernanceBody();
        await GovernanceV2._setCreationStatus('completed');
        return result;
      }
    } catch (error) {
      if (error.message && error.message.includes('no such table')) {
        loggerV2.debug('[v2]: V1 Meta table does not exist, proceeding with new V2 governance body creation');
      } else {
        await GovernanceV2._setCreationStatus('failed', error.message);
        throw error;
      }
    }

    const dataModelVersion = 'v2';
    await datalayer.waitForSpendableCoins(2);
    const governanceBodyId = await datalayer.createDataLayerStoreWithRetry();
    const governanceVersionId = await datalayer.createDataLayerStoreWithRetry();

    await GovernanceV2._setCreationStatus('waiting_for_confirmation');

    const revertIfFailed = async () => {
      loggerV2.warn('[v2]: Reverting Failed Governance Body Creation');
      await MetaV2.destroy({ where: { meta_key: 'governanceBodyId' } });
      await GovernanceV2._setCreationStatus('failed', 'Governance body creation reverted');
    };

    await datalayer.syncDataLayer(
      governanceBodyId,
      {
        [dataModelVersion]: governanceVersionId,
      },
      revertIfFailed,
    );

    await GovernanceV2._setCreationStatus('syncing_data');

    const onConfirm = async () => {
      await MetaV2.upsert({
        meta_key: 'governanceBodyId',
        meta_value: governanceVersionId,
      });
      await MetaV2.upsert({
        meta_key: 'mainGoveranceBodyId',
        meta_value: governanceBodyId,
      });
      await GovernanceV2._setCreationStatus('completed');
      loggerV2.info('[v2]: V2 Governance body confirmed, you are ready to go');
    };

    if (!USE_SIMULATOR) {
      loggerV2.info('[v2]: Waiting for New V2 Governance Body to be confirmed');
      datalayer.getStoreData(
        governanceBodyId,
        onConfirm,
        revertIfFailed,
      );
    } else {
      await onConfirm();
    }

    return governanceVersionId;
  }

  /**
   * Update governance body data on the datalayer
   * Upserts governance records and pushes changes to datalayer
   *
   * @param {Array<Object>} keyValueArray - Array of {key, value} objects to update
   * @throws {Error} If no governance body exists
   */
  static async updateGoveranceBodyData(keyValueArray) {
    const governanceBodyId = await MetaV2.findOne({
      where: { meta_key: 'governanceBodyId' },
      raw: true,
    });

    if (!governanceBodyId) {
      throw new Error(
        'There is no V2 Governance Body that you own that can be edited',
      );
    }

    const storeId = governanceBodyId.meta_value;
    const { USE_SIMULATOR } = getConfig().APP;

    await assertStoreIsOwned(storeId);
    if (!USE_SIMULATOR) {
      await assertOwnedStoreLocalDataIntact(storeId);
    }

    const existingRecords = await GovernanceV2.findAll({ raw: true });

    const changeList = [];

    await Promise.all(
      keyValueArray.map(async (keyValue) => {
        const valueExists = existingRecords.find(
          (record) => record.meta_key === keyValue.key,
        );

        await GovernanceV2.upsert({
          meta_key: keyValue.key,
          meta_value: keyValue.value,
          confirmed: false,
        });

        changeList.push(
          ...keyValueToChangeList(keyValue.key, keyValue.value, valueExists),
        );
      }),
    );

    const rollbackChangesIfFailed = async () => {
      loggerV2.info('[v2]: Reverting V2 Governance Records');
      await GovernanceV2.destroy({
        where: {
          id: {
            [Sequelize.Op.ne]: null,
          },
        },
        truncate: true,
      });

      await Promise.all(
        existingRecords.map(async (record) => await GovernanceV2.upsert(record)),
      );
    };

    const onConfirm = async () => {
      await Promise.all(
        keyValueArray.map(async (keyValue) => {
          await GovernanceV2.upsert({
            meta_key: keyValue.key,
            meta_value: keyValue.value,
            confirmed: true,
          });
        }),
      );
    };

    if (!USE_SIMULATOR) {
      await datalayer.waitForAllTransactionsToConfirm();
    }

    await datalayer.pushDataLayerChangeList(
      storeId,
      changeList,
      rollbackChangesIfFailed,
    );

    if (!USE_SIMULATOR) {
      datalayer.getStoreData(
        storeId,
        onConfirm,
        rollbackChangesIfFailed,
      );
    } else {
      onConfirm();
    }
  }

  /**
   * Sync governance data from datalayer.
   * Downloads governance data from subscribed governance body store.
   * Returns without throwing on any failure; the next scheduled task run will retry.
   */
  static async sync() {
    loggerV2.debug('[v2]: running V2 governance model sync()');

    const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;

    // Simulator / development mode: use stub data and return immediately.
    // Check this FIRST before GOVERNANCE_BODY_ID to avoid errors in test mode.
    if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
      loggerV2.info('[v2]: SIMULATOR/TESTNET MODE: Using sample picklist');
      await GovernanceV2.upsert({
        meta_key: 'pickList',
        meta_value: JSON.stringify(PickListStub),
        confirmed: true,
      });
      return;
    }

    const { GOVERNANCE_BODY_ID } = getConfigV2().GOVERNANCE;

    if (!GOVERNANCE_BODY_ID) {
      loggerV2.error('[v2]: Missing GOVERNANCE_BODY_ID in env, cannot sync governance data');
      return;
    }

    // Subscribe to the governance body store first so it begins syncing on
    // fresh deployments. Without this, an unsubscribed store would cause
    // getDataLayerStoreSyncStatus to error (the DL node has no record of
    // it), we'd skip, and no subsequent run would ever subscribe — a
    // permanent skip loop.  subscribeToStoreOnDataLayer returns falsy on
    // failure (datalayer unreachable, subscribe RPC failure) and also
    // throws on unexpected errors, so we guard against both.
    try {
      const subscribed = await datalayer.subscribeToStoreOnDataLayer(GOVERNANCE_BODY_ID);
      if (!subscribed) {
        loggerV2.warn(
          `[v2]: could not subscribe to governance body store ${GOVERNANCE_BODY_ID}. Skipping sync, will retry on next task run.`,
        );
        return;
      }
    } catch (error) {
      loggerV2.warn(
        `[v2]: could not subscribe to governance body store ${GOVERNANCE_BODY_ID}: ${error.message}. Skipping sync, will retry on next task run.`,
      );
      return;
    }

    // Check governance body store sync status before any blocking fetch.
    // If the store is not yet synced, return immediately so cached governance
    // data remains usable and the next task run retries.
    try {
      const bodyStoreSyncStatus = await datalayer.getDataLayerStoreSyncStatus(GOVERNANCE_BODY_ID);
      if (!isDlStoreSynced(bodyStoreSyncStatus?.sync_status)) {
        loggerV2.debug(
          `[v2]: governance body store ${GOVERNANCE_BODY_ID} not yet synced. Skipping sync, will retry on next task run.`,
        );
        GovernanceV2._emitHeartbeat('body', GOVERNANCE_BODY_ID, bodyStoreSyncStatus?.sync_status);
        return;
      }
    } catch (error) {
      loggerV2.warn(
        `[v2]: could not check sync status for governance body store ${GOVERNANCE_BODY_ID}: ${error.message}. Skipping sync.`,
      );
      return;
    }

    // Single attempt.  On any failure, log and return — the scheduler will
    // run the task again on its normal cadence.  No in-task retry loop so the
    // coroutine never blocks its scheduler slot.
    try {
      const governanceData = await datalayer.getSubscribedStoreData(
        GOVERNANCE_BODY_ID,
        undefined,
        false,
      );

      const shouldSyncLegacy = !Object.keys(governanceData).some((key) =>
        /^v?[0-9]+$/.test(key),
      );

      if (shouldSyncLegacy) {
        loggerV2.info(
          `[v2]: using legacy governance upsert method for governance store ${GOVERNANCE_BODY_ID}`,
        );
        const { changed } = await GovernanceV2.upsertGovernanceDownload(GOVERNANCE_BODY_ID, governanceData);
        if (changed) {
          loggerV2.info('[v2]: Successfully synced legacy governance data');
        } else {
          loggerV2.debug('[v2]: Legacy governance data unchanged, no update needed');
        }
        return;
      }

      const dataModelVersion = 'v2'; // CRITICAL: Hardcode 'v2', not getDataModelVersion()
      const versionedGovernanceStoreId = governanceData[dataModelVersion];

      if (!versionedGovernanceStoreId) {
        loggerV2.warn(
          `[v2]: governance data is not available from store ${GOVERNANCE_BODY_ID} for ${dataModelVersion} data model. Legacy data may have been synced.`,
        );
        return;
      }

      // Subscribe to the versioned governance store first (its ID is only
      // discovered by reading the body store above), then check sync status.
      // Same reasoning as the body-store subscribe above.
      try {
        const versionedSubscribed = await datalayer.subscribeToStoreOnDataLayer(versionedGovernanceStoreId);
        if (!versionedSubscribed) {
          loggerV2.warn(
            `[v2]: could not subscribe to versioned governance store ${versionedGovernanceStoreId}. Skipping sync, will retry on next task run.`,
          );
          return;
        }
      } catch (error) {
        loggerV2.warn(
          `[v2]: could not subscribe to versioned governance store ${versionedGovernanceStoreId}: ${error.message}. Skipping sync, will retry on next task run.`,
        );
        return;
      }

      // Check versioned governance store sync status before fetching
      try {
        const versionedSyncStatus = await datalayer.getDataLayerStoreSyncStatus(versionedGovernanceStoreId);
        if (!isDlStoreSynced(versionedSyncStatus?.sync_status)) {
          loggerV2.debug(
            `[v2]: versioned governance store ${versionedGovernanceStoreId} not yet synced. Skipping sync, will retry on next task run.`,
          );
          GovernanceV2._emitHeartbeat('versioned', versionedGovernanceStoreId, versionedSyncStatus?.sync_status);
          return;
        }
      } catch (error) {
        loggerV2.warn(
          `[v2]: could not check sync status for versioned governance store ${versionedGovernanceStoreId}: ${error.message}. Skipping sync.`,
        );
        return;
      }

      loggerV2.debug(
        `[v2]: getting ${dataModelVersion} governance data from store ${versionedGovernanceStoreId}`,
      );
      const versionedGovernanceData = await datalayer.getSubscribedStoreData(
        versionedGovernanceStoreId,
        undefined,
        false,
      );

      const { changed } = await GovernanceV2.upsertGovernanceDownload(GOVERNANCE_BODY_ID, versionedGovernanceData);
      if (changed) {
        loggerV2.info('[v2]: Successfully synced versioned governance data');
      } else {
        loggerV2.debug('[v2]: Versioned governance data unchanged, no update needed');
      }
    } catch (error) {
      loggerV2.error(
        `[v2]: Error syncing governance data: ${error.message}. Cached governance data will be used until next task run.`,
      );
    }
  }

  /**
   * Subscribe to a governance body store
   * Subscribes to the governance body store on datalayer and stores the governance body ID
   * @param {string} governanceBodyId - The governance body store ID to subscribe to
   * @returns {Promise<{governanceBodyId: string}>}
   * @throws {Error} If subscription fails or governance body ID is invalid
   */
  static async subscribeToGovernanceBody(governanceBodyId) {
    const { USE_SIMULATOR } = getConfig().APP;

    if (!governanceBodyId) {
      throw new Error('governanceBodyId is required');
    }

    loggerV2.info(`[v2]: Subscribing to governance body store ${governanceBodyId}`);

    // Subscribe to governance body store on datalayer
    const subscribed = await datalayer.subscribeToStoreOnDataLayer(governanceBodyId);

    // In simulator mode, subscribeToStoreOnDataLayer returns undefined (no-op)
    // In production mode, it returns true/false
    if (!USE_SIMULATOR && !subscribed) {
      throw new Error(
        `Failed to subscribe to or validate subscription for governance body store ${governanceBodyId}`,
      );
    }

    // Store governance body ID in MetaV2 for future sync operations
    await MetaV2.upsert({
      meta_key: 'governanceBodyId',
      meta_value: governanceBodyId,
    });

    loggerV2.info(`[v2]: Successfully subscribed to governance body store ${governanceBodyId}`);

    return {
      governanceBodyId,
    };
  }
}

GovernanceV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'GovernanceV2',
  tableName: 'governance',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default GovernanceV2;
