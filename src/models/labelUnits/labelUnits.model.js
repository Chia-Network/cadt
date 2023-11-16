'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database';

import ModelTypes from './labelUnits.modeltypes.cjs';
import { LabelUnitMirror } from './labelUnits.model.mirror';

class LabelUnit extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelUnitMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelUnitMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelUnitMirror.upsert(values, mirrorOptions);
    });
    return super.upsert(values, options);
  }
}

LabelUnit.init(ModelTypes, {
  sequelize,
  modelName: 'label_unit',
  freezeTableName: true,
  timestamps: true,
});

export { LabelUnit };
