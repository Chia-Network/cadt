'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './stakeholder-projects-v2.modeltypes.cjs';

class StakeholderProjectV2 extends Model {}

StakeholderProjectV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'StakeholderProjectV2',
  tableName: 'stakeholder_projects',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
StakeholderProjectV2.associate = (models) => {
  // Stakeholder-Project belongs to Stakeholder
  StakeholderProjectV2.belongsTo(models.StakeholderV2, {
    foreignKey: 'cadTrustStakeholderId',
    as: 'stakeholder',
  });

  // Stakeholder-Project belongs to Project
  StakeholderProjectV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });
};

export { StakeholderProjectV2 };
