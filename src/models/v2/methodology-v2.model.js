'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './methodology-v2.modeltypes.cjs';

class MethodologyV2 extends Model {}

MethodologyV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'MethodologyV2',
  tableName: 'methodology',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export { MethodologyV2 };
