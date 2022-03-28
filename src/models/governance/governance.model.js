'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../../database';
import { Meta } from '../../models';
import datalayer from '../../datalayer';
import { keyValueToChangeList } from '../../utils/datalayer-utils';

import ModelTypes from './governance.modeltypes.cjs';

class Governance extends Model {
  static async createGoveranceBody() {
    const goveranceBodyId = await datalayer.createDataLayerStore();

    if (process.env.GOVERANCE_BODY_ID && process.env.GOVERANCE_BODY_ID !== '') {
      throw new Error(
        'You are already listening to another governance body. Please clear GOVERANCE_BODY_ID from your env and try again',
      );
    }

    await Meta.upsert({
      metaKey: 'goveranceBodyId',
      metaValue: goveranceBodyId,
    });

    return goveranceBodyId;
  }

  static async sync() {
    const { GOVERANCE_BODY_ID, GOVERNANCE_BODY_IP, GOVERNANCE_BODY_PORT } =
      process.env;

    if (!GOVERANCE_BODY_ID || !GOVERNANCE_BODY_IP || !GOVERNANCE_BODY_PORT) {
      throw new Error('Missing information in env to sync Governance data');
    }

    const governanceData = await datalayer.getSubscribedStoreData(
      GOVERANCE_BODY_ID,
      GOVERNANCE_BODY_IP,
      GOVERNANCE_BODY_PORT,
    );

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
    }

    await Promise.all(updates.map(async (update) => Governance.upsert(update)));
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
      console.log('Reverting Goverance Records');
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
