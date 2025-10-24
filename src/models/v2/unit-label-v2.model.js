'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './unit-label-v2.modeltypes.cjs';

class UnitLabelV2 extends Model {}

UnitLabelV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'UnitLabelV2',
  tableName: 'unit_label',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  // Define composite primary key
  primaryKey: ['cadTrustLabelId', 'cadTrustUnitId'],
});

// Define associations
UnitLabelV2.associate = (models) => {
  // Unit-Label belongs to Label
  UnitLabelV2.belongsTo(models.LabelV2, {
    foreignKey: 'cadTrustLabelId',
    as: 'label',
  });

  // Unit-Label belongs to Unit
  UnitLabelV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });
};

export { UnitLabelV2 };
