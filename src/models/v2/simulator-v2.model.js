'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './simulator-v2.modeltypes.cjs';

class SimulatorV2 extends Model {
  // V2-specific simulator methods will be added here as needed
}

SimulatorV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'SimulatorV2',
  tableName: 'simulator',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default SimulatorV2;
