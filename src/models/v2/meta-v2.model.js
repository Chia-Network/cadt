'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './meta-v2.modeltypes.cjs';

class MetaV2 extends Model {
  // V2-specific meta methods will be added here as needed
}

MetaV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'MetaV2',
  tableName: 'meta',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default MetaV2;
