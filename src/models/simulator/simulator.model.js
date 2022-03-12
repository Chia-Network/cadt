'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../../database';

import ModelTypes from './simulator.modeltypes.cjs';

class Simulator extends Model {}

Simulator.init(ModelTypes, {
  sequelize,
  modelName: 'simulator',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export { Simulator };
