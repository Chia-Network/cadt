'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './organizations-v2.modeltypes.cjs';

class OrganizationsV2 extends Model {
  // V2-specific organization methods will be added here as needed
}

OrganizationsV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'OrganizationsV2',
  tableName: 'organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default OrganizationsV2;
