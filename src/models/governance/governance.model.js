'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../../database';

import ModelTypes from './governance.modeltypes.cjs';

class Governance extends Model {}

Governance.init(ModelTypes, {
  sequelize,
  modelName: 'meta',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export { Governance };
