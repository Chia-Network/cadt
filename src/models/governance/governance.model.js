'use strict';

import Sequelize from 'sequelize';

const { Model } = Sequelize;
import { sequelize } from '../../database';
import { Meta } from '../../models';
import datalayer from '../../datalayer';
import { keyValueToChangeList } from '../../utils/datalayer-utils';
import { CONFIG } from '../../user-config';
import { logger } from '../../logger.js';
import { getDataModelVersion } from '../../utils/helpers';
import PickListStub from './governance.stub.js';
import ModelTypes from './governance.modeltypes.cjs';

class Governance extends Model {
  static async createGoveranceBody() {
    if (
      CONFIG().CADT.GOVERNANCE.GOVERNANCE_BODY_ID &&
      CONFIG().CADT.GOVERNANCE.GOVERNANCE_BODY_ID !== ''
    ) {
      throw new Error(
        'You are already listening to another governance body. Please clear GOVERNANCE_BODY_ID from your env and try again',
      );
    }

    const dataModelVersion = getDataModelVersion();
    const governanceBodyId = await datalayer.createDataLayerStore();
    const governanceVersionId = await datalayer.createDataLayerStore();

    const revertOrganizationIfFailed = async () => {
      logger.warn('Reverting Failed Governance Body Creation');
      await Meta.destroy({ where: { metaKey: 'governanceBodyId' } });
    };

    // sync the governance store
    await datalayer.syncDataLayer(
      governanceBodyId,
      {
        [dataModelVersion]: governanceVersionId,
      },
      revertOrganizationIfFailed,
    );

    const onConfirm = async () => {
      try {
        await Meta.upsert({
          metaKey: 'governanceBodyId',
          metaValue: governanceVersionId,
        });
        await Meta.upsert({
          metaKey: 'mainGoveranceBodyId',
          metaValue: governanceBodyId,
        });
        logger.info('Governance body confirmed, you are ready to go');
      } catch (error) {
        logger.error('Error syncing governance data', error);
      }
    };

    if (!CONFIG().CADT.USE_SIMULATOR) {
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
    } else if (
      CONFIG().CADT.USE_SIMULATOR ||
      CONFIG().CADT.USE_DEVELOPMENT_MODE
    ) {
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
    const governanceBodyId = CONFIG()?.CADT?.GOVERNANCE.GOVERNANCE_BODY_ID;
    try {
      logger.debug('running governance model sync()');

      if (!governanceBodyId) {
        throw new Error('no governance body store ID in config');
      }

      // If on simulator or testnet, use the stubbed picklist data and return
      if (CONFIG().CADT.USE_SIMULATOR || CONFIG().CADT.USE_DEVELOPMENT_MODE) {
        logger.info('SIMULATOR/TESTNET MODE: Using sample picklist');
        Governance.upsert({
          metaKey: 'pickList',
          metaValue: JSON.stringify(PickListStub),
          confirmed: true,
        });

        return;
      }

      const governanceData = await datalayer.getSubscribedStoreData(
        governanceBodyId,
        undefined,
        true,
      );

      // Check if there is v1, v2, v3 ..... and if not, then we assume this is a legacy governance table that isnt versioned
      const shouldSyncLegacy = !Object.keys(governanceData).some((key) =>
        /^v?[0-9]+$/.test(key),
      );

      if (shouldSyncLegacy) {
        logger.info(
          `using legacy governance upsert method for governance store ${governanceBodyId}`,
        );
        await Governance.upsertGovernanceDownload(
          governanceBodyId,
          governanceData,
        );
      }

      // Check if the governance data for this version exists
      const dataModelVersion = getDataModelVersion();
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
          governanceBodyId,
          versionedGovernanceData,
        );
      } else {
        throw new Error(
          `Governance data is not available from store ${governanceBodyId} for ${dataModelVersion} data model.`,
        );
      }
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
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
        'There is no Goverance Body that you own that can be edited',
      );
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
      governanceBodyId.metaValue,
      changeList,
    );

    datalayer.getStoreData(
      governanceBodyId.metaValue,
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
