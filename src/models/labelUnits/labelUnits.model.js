'use strict';

import { Model } from 'sequelize';
import { sequelize, mirrorWrite } from '../../database';

import ModelTypes from './labelUnits.modeltypes.js';
import { LabelUnitMirror } from './labelUnits.model.mirror';

class LabelUnit extends Model {
  static async create(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelUnitMirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.create(values, options);
  }

  static async destroy(options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelUnitMirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    return super.destroy(options);
  }

  static async upsert(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelUnitMirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
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
