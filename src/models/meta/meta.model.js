'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../../database/index.js';

import ModelTypes from './meta.modeltypes.cjs';

class Meta extends Model {}

Meta.init(ModelTypes, {
  sequelize,
  modelName: 'meta',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export { Meta };
