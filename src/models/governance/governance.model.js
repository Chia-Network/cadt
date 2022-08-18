'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../../database';
import { Meta } from '../../models';
import datalayer from '../../datalayer';
import { keyValueToChangeList } from '../../utils/datalayer-utils';
import { getConfig } from '../../utils/config-loader';
import { logger } from '../../config/logger.cjs';
import { getDataModelVersion } from '../../utils/helpers';
import PickListStub from './governance.stub.json';

const { GOVERANCE_BODY_ID } = getConfig().GOVERNANCE;

const { USE_SIMULATOR, CHIA_NETWORK } = getConfig().APP;

import ModelTypes from './governance.modeltypes.cjs';

class Governance extends Model {
  static async createGoveranceBody() {
    if (GOVERANCE_BODY_ID && GOVERANCE_BODY_ID !== '') {
      throw new Error(
        'You are already listening to another governance body. Please clear GOVERANCE_BODY_ID from your env and try again',
      );
    }

    const dataModelVersion = getDataModelVersion();
    const goveranceBodyId = await datalayer.createDataLayerStore();
    const governanceVersionId = await datalayer.createDataLayerStore();

    const revertOrganizationIfFailed = async () => {
      logger.info('Reverting Failed Governance Body Creation');
      await Meta.destroy({ where: { metaKey: 'goveranceBodyId' } });
    };

    // sync the governance store
    await datalayer.syncDataLayer(
      goveranceBodyId,
      {
        [dataModelVersion]: governanceVersionId,
      },
      revertOrganizationIfFailed,
    );

    const onConfirm = async () => {
      logger.info('Organization confirmed, you are ready to go');
      await Meta.upsert({
        metaKey: 'goveranceBodyId',
        metaValue: governanceVersionId,
      });
      await Meta.upsert({
        metaKey: 'mainGoveranceBodyId',
        metaValue: goveranceBodyId,
      });
    };

    if (!USE_SIMULATOR) {
      logger.info('Waiting for New Governance Body to be confirmed');
      datalayer.getStoreData(
        goveranceBodyId,
        onConfirm,
        revertOrganizationIfFailed,
      );
    } else {
      onConfirm();
    }

    return governanceVersionId;
  }

  static async upsertGovernanceDownload(governanceData) {
    const updates = [];

    if (governanceData.orgList) {
      updates.push({
        metaKey: 'orgList',
        metaValue: governanceData.orgList,
        confirmed: true,
      });
    }

    if (governanceData.pickList) {
      updates.push({
        metaKey: 'pickList',
        metaValue: governanceData.pickList,
        confirmed: true,
      });
    } else if (USE_SIMULATOR || CHIA_NETWORK === 'testnet') {
      // this block is just a fallback if the app gets through the upstream checks,
      // might be unnecessary
      logger.info('SIMULATOR/TESTNET MODE: Using sample picklist');
      updates.push({
        metaKey: 'pickList',
        metaValue: JSON.stringify(PickListStub),
        confirmed: true,
      });
    }

    await Promise.all(updates.map(async (update) => Governance.upsert(update)));
  }

  static async sync() {
    try {
      if (!GOVERANCE_BODY_ID) {
        throw new Error('Missing information in env to sync Governance data');
      }

      // If on simulator or testnet, use the stubbed picklist data and return
      if (USE_SIMULATOR || CHIA_NETWORK === 'testnet') {
        logger.info('SIMULATOR/TESTNET MODE: Using sample picklist');
        Governance.upsert({
          metaKey: 'pickList',
          metaValue: JSON.stringify(PickListStub),
          confirmed: true,
        });

        return;
      }

      const governanceData = await datalayer.getSubscribedStoreData(
        GOVERANCE_BODY_ID,
      );

      // Check if there is v1, v2, v3 ..... and if not, then we assume this is a legacy goverance table that isnt versioned
      const shouldSyncLegacy = !Object.keys(governanceData).some((key) =>
        /^v?[0-9]+$/.test(key),
      );

      if (shouldSyncLegacy) {
        await Governance.upsertGovernanceDownload(governanceData);
      }

      // Check if the governance data for this version exists
      const dataModelVersion = getDataModelVersion();
      if (governanceData[dataModelVersion]) {
        const versionedGovernanceData = await datalayer.getSubscribedStoreData(
          governanceData[dataModelVersion],
        );

        await Governance.upsertGovernanceDownload(versionedGovernanceData);
      } else {
        throw new Error(
          `Governance data is not available from this source for ${dataModelVersion} data model.`,
        );
      }
    } catch (error) {
      logger.error('Error Syncing Governance Data', error);
    }
  }

  static async updateGoveranceBodyData(keyValueArray) {
    const goveranceBodyId = await Meta.findOne({
      where: { metaKey: 'goveranceBodyId' },
      raw: true,
    });

    if (!goveranceBodyId) {
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
        where: {},
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
      goveranceBodyId.metaValue,
      changeList,
    );

    datalayer.getStoreData(
      goveranceBodyId.metaValue,
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
