'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './co-benefit-v2.modeltypes.cjs';

class CoBenefitV2 extends Model {}

CoBenefitV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'CoBenefitV2',
  tableName: 'co_benefit',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
CoBenefitV2.associate = (models) => {
  // Co-Benefit belongs to Project
  CoBenefitV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });
};

export { CoBenefitV2 };
