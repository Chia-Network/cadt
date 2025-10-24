'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t3-actions-v2.modeltypes.cjs';

class AefT3ActionsV2 extends Model {}

AefT3ActionsV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT3ActionsV2',
  tableName: 'aef_t3_actions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT3ActionsV2.associate = (models) => {
  // AEF-T3-Actions belongs to AEF-T1-Submission
  AefT3ActionsV2.belongsTo(models.AefT1SubmissionV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'aefT1Submission',
  });

  // AEF-T3-Actions belongs to Unit
  AefT3ActionsV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });

  // AEF-T3-Actions belongs to Project
  AefT3ActionsV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // AEF-T3-Actions belongs to AEF-T2-Authorizations
  AefT3ActionsV2.belongsTo(models.AefT2AuthorizationsV2, {
    foreignKey: 'cadTrustAefT2AuthorizationsId',
    as: 'aefT2Authorizations',
  });
};

export { AefT3ActionsV2 };
