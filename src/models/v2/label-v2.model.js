'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './label-v2.modeltypes.cjs';

class LabelV2 extends Model {}

LabelV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'LabelV2',
  tableName: 'label',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
LabelV2.associate = (models) => {
  // Label has many UnitLabels (many-to-many with Unit)
  LabelV2.hasMany(models.UnitLabelV2, {
    foreignKey: 'cadTrustLabelId',
    as: 'unitLabels',
  });
};

export { LabelV2 };
