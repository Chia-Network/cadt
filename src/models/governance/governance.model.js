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
      goveranceBodyId,
    });

    return goveranceBodyId;
  }

  static async updateGoveranceBodyData(keyValueArray) {
    const goveranceBodyId = await Meta.find({
      where: { metaKey: 'goveranceBodyId' },
    });

    if (!goveranceBodyId) {
      throw new Error(
        'There is no Goverance Body that you own that can be edited',
      );
    }

    const existingRecords = Governance.findAll({ raw: true });

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
          keyValueToChangeList(keyValue.key, keyValue.value, valueExists),
        );
      }),
    );

    const rollbackChangesIfFailed = async () => {
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

    await datalayer.pushDataLayerChangeList(goveranceBodyId, changeList);

    datalayer.getStoreData(goveranceBodyId, onConfirm, rollbackChangesIfFailed);
  }
}

Governance.init(ModelTypes, {
  sequelize,
  modelName: 'meta',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export { Governance };
