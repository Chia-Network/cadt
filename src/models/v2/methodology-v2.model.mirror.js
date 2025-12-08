'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './methodology-v2.modeltypes.cjs';

class MethodologyV2Mirror extends Model {}

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
