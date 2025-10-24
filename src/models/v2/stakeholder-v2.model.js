'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './stakeholder-v2.modeltypes.cjs';

class StakeholderV2 extends Model {}

StakeholderV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'StakeholderV2',
  tableName: 'stakeholder',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
StakeholderV2.associate = (models) => {
  // Stakeholder has many StakeholderProjects (many-to-many with Project)
  StakeholderV2.hasMany(models.StakeholderProjectV2, {
    foreignKey: 'cadTrustStakeholderId',
    as: 'stakeholderProjects',
  });
};

export { StakeholderV2 };
