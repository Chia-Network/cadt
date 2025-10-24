'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t4-holdings-v2.modeltypes.cjs';

class AefT4HoldingsV2 extends Model {}

AefT4HoldingsV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT4HoldingsV2',
  tableName: 'aef_t4_holdings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT4HoldingsV2.associate = (models) => {
  // AEF-T4-Holdings belongs to AEF-T1-Submission
  AefT4HoldingsV2.belongsTo(models.AefT1SubmissionV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'aefT1Submission',
  });

  // AEF-T4-Holdings belongs to Unit
  AefT4HoldingsV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });

  // AEF-T4-Holdings belongs to Project
  AefT4HoldingsV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // AEF-T4-Holdings belongs to AEF-T2-Authorizations
  AefT4HoldingsV2.belongsTo(models.AefT2AuthorizationsV2, {
    foreignKey: 'cadTrustAefT2AuthorizationsId',
    as: 'aefT2Authorizations',
  });
};

export { AefT4HoldingsV2 };
