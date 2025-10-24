'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './estimation-v2.modeltypes.cjs';

class EstimationV2 extends Model {}

EstimationV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'EstimationV2',
  tableName: 'estimation',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
EstimationV2.associate = (models) => {
  // Estimation belongs to Project
  EstimationV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });
};

export { EstimationV2 };
