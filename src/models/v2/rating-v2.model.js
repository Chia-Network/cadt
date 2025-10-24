'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './rating-v2.modeltypes.cjs';

class RatingV2 extends Model {}

RatingV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'RatingV2',
  tableName: 'rating',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
RatingV2.associate = (models) => {
  // Rating belongs to Project
  RatingV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });
};

export { RatingV2 };
