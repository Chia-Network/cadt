'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './methodology-v2.modeltypes.cjs';

class MethodologyV2Mirror extends Model {
  static async create(values, options) {
    const result = await super.create(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    const result = await super.bulkCreate(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    const result = await super.update(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }
}

MethodologyV2Mirror.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'MethodologyV2Mirror',
  tableName: 'methodology', // Mirror table uses the same table name
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export { MethodologyV2Mirror };
