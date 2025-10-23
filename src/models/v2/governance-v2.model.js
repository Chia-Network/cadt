'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './governance-v2.modeltypes.cjs';

class GovernanceV2 extends Model {
  // V2-specific governance methods will be added here as needed
}

GovernanceV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'GovernanceV2',
  tableName: 'governance',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default GovernanceV2;
