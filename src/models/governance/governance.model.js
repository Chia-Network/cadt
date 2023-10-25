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
      logger.info('Reverting Failed Governance Body Creation');
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
      logger.info('Organization confirmed, you are ready to go');
      await Meta.upsert({
        metaKey: 'governanceBodyId',
        metaValue: governanceVersionId,
      });
      await Meta.upsert({
        metaKey: 'mainGoveranceBodyId',
        metaValue: governanceBodyId,
      });
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

  static async upsertGovernanceDownload(governanceData) {
    const updates = [];

    if (governanceData.orgList) {
      updates.push({
        metaKey: 'orgList',
        metaValue: governanceData.orgList,
        confirmed: true,
      });
    }

    if (governanceData.glossary) {
      updates.push({
        metaKey: 'glossary',
        metaValue: governanceData.glossary,
        confirmed: true,
      });
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
    }

    await Promise.all(updates.map(async (update) => Governance.upsert(update)));
  }

  static async sync() {
    try {
      if (!CONFIG().CADT.GOVERNANCE.GOVERNANCE_BODY_ID) {
        throw new Error('Missing information in env to sync Governance data');
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
        CONFIG().CADT.GOVERNANCE.GOVERNANCE_BODY_ID,
      );

      // Check if there is v1, v2, v3 ..... and if not, then we assume this is a legacy governance table that isnt versioned
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
