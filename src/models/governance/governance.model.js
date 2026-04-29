'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelize } from '../../database';
import { Meta } from '../../models';
import datalayer from '../../datalayer';
import { keyValueToChangeList, isDlStoreSynced } from '../../utils/datalayer-utils';
import { getConfig } from '../../utils/config-loader';
import { logger } from '../../config/logger.js';
import {
  assertStoreIsOwned,
  assertOwnedStoreLocalDataIntact,
} from '../../utils/data-assertions';
import PickListStub from './governance.stub.js';

const { GOVERNANCE_BODY_ID } = getConfig().GOVERNANCE;

const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;

import ModelTypes from './governance.modeltypes.js';

class Governance extends Model {
  static async _setCreationStatus(status, error = null) {
    try {
      await Meta.upsert({ metaKey: 'governanceCreationStatus', metaValue: status });
      await Meta.upsert({ metaKey: 'governanceCreationStartedAt', metaValue: Governance._creationStartedAt || new Date().toISOString() });
      if (error) {
        await Meta.upsert({ metaKey: 'governanceCreationError', metaValue: String(error) });
      } else {
        await Meta.destroy({ where: { metaKey: 'governanceCreationError' } });
      }
    } catch (e) {
      logger.error(`Failed to update governance creation status: ${e.message}`);
    }
  }

  static async createGoveranceBody() {
    if (GOVERNANCE_BODY_ID && GOVERNANCE_BODY_ID !== '') {
      throw new Error(
        'You are already listening to another governance body. Please clear GOVERNANCE_BODY_ID from your env and try again',
      );
    }

    Governance._creationStartedAt = new Date().toISOString();
    await Governance._setCreationStatus('creating_stores');

    const dataModelVersion = 'v1';
    await datalayer.waitForSpendableCoins(2);
    const governanceBodyId = await datalayer.createDataLayerStoreWithRetry();
    const governanceVersionId = await datalayer.createDataLayerStoreWithRetry();

    await Governance._setCreationStatus('waiting_for_confirmation');

    const revertOrganizationIfFailed = async () => {
      logger.warn('Reverting Failed Governance Body Creation');
      await Meta.destroy({ where: { metaKey: 'governanceBodyId' } });
      await Governance._setCreationStatus('failed', 'Governance body creation reverted');
    };

    await datalayer.syncDataLayer(
      governanceBodyId,
      {
        [dataModelVersion]: governanceVersionId,
      },
      revertOrganizationIfFailed,
    );

    await Governance._setCreationStatus('syncing_data');

    const onConfirm = async () => {
      await Meta.upsert({
        metaKey: 'governanceBodyId',
        metaValue: governanceVersionId,
      });
      await Meta.upsert({
        metaKey: 'mainGoveranceBodyId',
        metaValue: governanceBodyId,
      });
      await Governance._setCreationStatus('completed');
      logger.info('Governance body confirmed, you are ready to go');
    };

    if (!USE_SIMULATOR) {
      logger.info('Waiting for New Governance Body to be confirmed');
      datalayer.getStoreData(
        governanceBodyId,
        onConfirm,
        revertOrganizationIfFailed,
      );
    } else {
      onConfirm();
    }

    return governanceVersionId;
  }

  static async upsertGovernanceDownload(
    sourceGovernanceBodyId,
    governanceData,
  ) {
    if (!governanceData) {
      throw new Error(
        'upsertGovernanceDownload() received a nil or falsy governance data value',
      );
    }

    const updates = [];

    if (governanceData.orgList) {
      updates.push({
        metaKey: 'orgList',
        metaValue: governanceData.orgList,
        confirmed: true,
      });
    } else {
      logger.warn(
        `governance data in store ${sourceGovernanceBodyId} does not contain orgList values`,
      );
    }

    if (governanceData.glossary) {
      updates.push({
        metaKey: 'glossary',
        metaValue: governanceData.glossary,
        confirmed: true,
      });
    } else {
      logger.warn(
        `governance data in store ${sourceGovernanceBodyId} does not contain glossary values`,
      );
    }

    if (governanceData.pickList) {
      updates.push({
        metaKey: 'pickList',
        metaValue: governanceData.pickList,
        confirmed: true,
      });
    } else if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
      // this block is just a fallback if the app gets through the upstream checks,
      // might be unnecessary
      logger.info('SIMULATOR/DEVELOPMENT MODE: Using sample picklist');
      updates.push({
        metaKey: 'pickList',
        metaValue: JSON.stringify(PickListStub),
        confirmed: true,
      });
    } else {
      logger.warn(
        `governance data in store ${sourceGovernanceBodyId} does not contain picklist values`,
      );
    }

    logger.debug('upserting governance data from governance body store');
    await Promise.all(updates.map(async (update) => Governance.upsert(update)));
  }

  static async sync() {
    logger.debug('[v1]: running governance model sync()');

    // Check simulator/dev mode first to match V2 behavior and avoid errors
    // in test/dev environments that may not have GOVERNANCE_BODY_ID configured.
    if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
      logger.info('[v1]: SIMULATOR/TESTNET MODE: Using sample picklist');
      await Governance.upsert({
        metaKey: 'pickList',
        metaValue: JSON.stringify(PickListStub),
        confirmed: true,
      });
      return;
    }

    if (!GOVERNANCE_BODY_ID) {
      logger.error('[v1]: Missing GOVERNANCE_BODY_ID in env, cannot sync governance data');
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
        logger.warn(
          `[v1]: could not subscribe to governance body store ${GOVERNANCE_BODY_ID}. Skipping sync, will retry on next task run.`,
        );
        return;
      }
    } catch (error) {
      logger.warn(
        `[v1]: could not subscribe to governance body store ${GOVERNANCE_BODY_ID}: ${error.message}. Skipping sync, will retry on next task run.`,
      );
      return;
    }

    // Check governance body store sync status before any blocking fetch.
    // If the store is not yet synced, return immediately so cached governance
    // data remains usable and the next task run retries.
    try {
      const bodyStoreSyncStatus = await datalayer.getDataLayerStoreSyncStatus(GOVERNANCE_BODY_ID);
      if (!isDlStoreSynced(bodyStoreSyncStatus?.sync_status)) {
        logger.info(
          `[v1]: governance body store ${GOVERNANCE_BODY_ID} not yet synced. Skipping sync, will retry on next task run.`,
        );
        return;
      }
    } catch (error) {
      logger.warn(
        `[v1]: could not check sync status for governance body store ${GOVERNANCE_BODY_ID}: ${error.message}. Skipping sync.`,
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
        logger.info(
          `[v1]: using legacy governance upsert method for governance store ${GOVERNANCE_BODY_ID}`,
        );
        await Governance.upsertGovernanceDownload(GOVERNANCE_BODY_ID, governanceData);
        return;
      }

      const dataModelVersion = 'v1';
      const versionedGovernanceStoreId = governanceData[dataModelVersion];
      if (!versionedGovernanceStoreId) {
        logger.error(
          `[v1]: governance data is not available from store ${GOVERNANCE_BODY_ID} for ${dataModelVersion} data model. Skipping sync.`,
        );
        return;
      }

      // Subscribe to the versioned governance store first (its ID is only
      // discovered by reading the body store above), then check sync status.
      // Same reasoning as the body-store subscribe above.
      try {
        const versionedSubscribed = await datalayer.subscribeToStoreOnDataLayer(versionedGovernanceStoreId);
        if (!versionedSubscribed) {
          logger.warn(
            `[v1]: could not subscribe to versioned governance store ${versionedGovernanceStoreId}. Skipping sync, will retry on next task run.`,
          );
          return;
        }
      } catch (error) {
        logger.warn(
          `[v1]: could not subscribe to versioned governance store ${versionedGovernanceStoreId}: ${error.message}. Skipping sync, will retry on next task run.`,
        );
        return;
      }

      // Check versioned governance store sync status before fetching
      try {
        const versionedSyncStatus = await datalayer.getDataLayerStoreSyncStatus(versionedGovernanceStoreId);
        if (!isDlStoreSynced(versionedSyncStatus?.sync_status)) {
          logger.info(
            `[v1]: versioned governance store ${versionedGovernanceStoreId} not yet synced. Skipping sync, will retry on next task run.`,
          );
          return;
        }
      } catch (error) {
        logger.warn(
          `[v1]: could not check sync status for versioned governance store ${versionedGovernanceStoreId}: ${error.message}. Skipping sync.`,
        );
        return;
      }

      logger.debug(
        `[v1]: getting ${dataModelVersion} governance data from store ${versionedGovernanceStoreId}`,
      );
      const versionedGovernanceData = await datalayer.getSubscribedStoreData(
        versionedGovernanceStoreId,
        undefined,
        false,
      );

      await Governance.upsertGovernanceDownload(GOVERNANCE_BODY_ID, versionedGovernanceData);
    } catch (error) {
      logger.error(
        `[v1]: Error syncing governance data: ${error.message}. Cached governance data will be used until next task run.`,
      );
    }
  }

  static async updateGoveranceBodyData(keyValueArray) {
    const governanceBodyId = await Meta.findOne({
      where: { metaKey: 'governanceBodyId' },
      raw: true,
    });

    if (!governanceBodyId) {
      throw new Error(
        'There is no Governance Body that you own that can be edited',
      );
    }

    const storeId = governanceBodyId.metaValue;

    await assertStoreIsOwned(storeId);
    if (!USE_SIMULATOR) {
      await assertOwnedStoreLocalDataIntact(storeId);
    }

    const existingRecords = await Governance.findAll({ raw: true });

    const changeList = [];

    await Promise.all(
      keyValueArray.map(async (keyValue) => {
        const valueExists = existingRecords.find(
          (record) => record.metaKey === keyValue.key,
        );

        await Governance.upsert({
          metaKey: keyValue.key,
          metaValue: keyValue.value,
          confirmed: false,
        });

        changeList.push(
          ...keyValueToChangeList(keyValue.key, keyValue.value, valueExists),
        );
      }),
    );

    const rollbackChangesIfFailed = async () => {
      logger.info('Reverting Goverance Records');
      await Governance.destroy({
        where: {
          id: {
            [Sequelize.Op.ne]: null,
          },
        },
        truncate: true,
      });

      await Promise.all(
        existingRecords.map(async (record) => await Governance.upsert(record)),
      );
    };

    const onConfirm = async () => {
      await Promise.all(
        keyValueArray.map(async (keyValue) => {
          await Governance.upsert({
            metaKey: keyValue.key,
            metaValue: keyValue.value,
            confirmed: true,
          });
        }),
      );
    };

    await datalayer.pushDataLayerChangeList(
      storeId,
      changeList,
      rollbackChangesIfFailed,
    );

    datalayer.getStoreData(
      storeId,
      onConfirm,
      rollbackChangesIfFailed,
    );
  }
}

Governance.init(ModelTypes, {
  sequelize,
  modelName: 'governance',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export { Governance };
