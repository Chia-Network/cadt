'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database';
import { StatisticsMirror } from './statistics.model.mirror';
import ModelTypes from './statistics.modeltypes.cjs';

class Statistics extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StatisticsMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StatisticsMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await StatisticsMirror.upsert(values, mirrorOptions);
    });
    return super.upsert(values, options);
  }
}

Statistics.init(ModelTypes, {
  sequelize,
  modelName: 'statistics',
  freezeTableName: true,
  timestamps: true,
  createdAt: true,
  updatedAt: true,
});

export { Statistics };
