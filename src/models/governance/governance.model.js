'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelize } from '../../database';
import { Meta } from '../../models';
import datalayer from '../../datalayer';
import { keyValueToChangeList } from '../../utils/datalayer-utils';
import { getConfig } from '../../utils/config-loader';
import { logger } from '../../config/logger.js';
import {
  assertStoreIsOwned,
  assertOwnedStoreLocalDataIntact,
} from '../../utils/data-assertions';
import PickListStub from './governance.stub.js';

const { GOVERNANCE_BODY_ID } = getConfig().GOVERNANCE;

const { USE_SIMULATOR, USE_DEVELOPMENT_MODE } = getConfig().APP;

import ModelTypes from './governance.modeltypes.cjs';

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

  static async sync(retryCounter = 0) {
    try {
      logger.debug('running governance model sync()');

      if (!GOVERNANCE_BODY_ID) {
        throw new Error('Missing information in env to sync Governance data');
      }

      // If on simulator or testnet, use the stubbed picklist data and return
      if (USE_SIMULATOR || USE_DEVELOPMENT_MODE) {
        logger.info('SIMULATOR/TESTNET MODE: Using sample picklist');
        // Await the upsert to ensure transaction completes before returning
        await Governance.upsert({
          metaKey: 'pickList',
          metaValue: JSON.stringify(PickListStub),
          confirmed: true,
        });

        return;
      }

      const governanceData = await datalayer.getSubscribedStoreData(
        GOVERNANCE_BODY_ID,
        undefined,
        true,
      );

      // Check if there is v1, v2, v3 ..... and if not, then we assume this is a legacy governance table that isnt versioned
      const shouldSyncLegacy = !Object.keys(governanceData).some((key) =>
        /^v?[0-9]+$/.test(key),
      );

      if (shouldSyncLegacy) {
        logger.info(
          `using legacy governance upsert method for governance store ${GOVERNANCE_BODY_ID}`,
        );
        await Governance.upsertGovernanceDownload(
          GOVERNANCE_BODY_ID,
          governanceData,
        );
      }

      // Check if the governance data for this version exists
      const dataModelVersion = 'v1';
      const versionedGovernanceStoreId = governanceData[dataModelVersion];
      if (versionedGovernanceStoreId) {
        logger.debug(
          `getting ${dataModelVersion} governance data from store ${versionedGovernanceStoreId}`,
        );
        const versionedGovernanceData = await datalayer.getSubscribedStoreData(
          versionedGovernanceStoreId,
          undefined,
          true,
        );

        await Governance.upsertGovernanceDownload(
          GOVERNANCE_BODY_ID,
          versionedGovernanceData,
        );
      } else {
        throw new Error(
          `Governance data is not available from store ${GOVERNANCE_BODY_ID} for ${dataModelVersion} data model.`,
        );
      }
    } catch (error) {
      await new Promise((resolve) => setTimeout(() => resolve(), 5000));
      const maxRetry = 50;
      if (retryCounter < maxRetry) {
        logger.error(
          `Error Syncing Governance Data. Retry attempt #${retryCounter + 1}. Retrying. Error:, ${error}`,
        );
        await Governance.sync(retryCounter + 1);
      } else {
        logger.error(
          `Error Syncing Governance Data. Retry attempts exceeded. This will not have the latest governance data and data sync may be impacted`,
        );
      }
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
