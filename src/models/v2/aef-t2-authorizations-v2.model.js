'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t2-authorizations-v2.modeltypes.cjs';

class AefT2AuthorizationsV2 extends Model {}

AefT2AuthorizationsV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT2AuthorizationsV2',
  tableName: 'aef_t2_authorizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT2AuthorizationsV2.associate = (models) => {
  // AEF-T2-Authorizations belongs to AEF-T1-Submission
  AefT2AuthorizationsV2.belongsTo(models.AefT1SubmissionV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'aefT1Submission',
  });

  // AEF-T2-Authorizations belongs to Unit
  AefT2AuthorizationsV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });

  // AEF-T2-Authorizations belongs to Project
  AefT2AuthorizationsV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // AEF-T2-Authorizations belongs to AEF-T5-Authorized-Entities
  AefT2AuthorizationsV2.belongsTo(models.AefT5AuthorizedEntitiesV2, {
    foreignKey: 'cadTrustAefT5AuthorizedEntitiesId',
    as: 'aefT5AuthorizedEntities',
  });

  // AEF-T2-Authorizations has many AEF-T3-Actions
  AefT2AuthorizationsV2.hasMany(models.AefT3ActionsV2, {
    foreignKey: 'cadTrustAefT2AuthorizationsId',
    as: 'actions',
  });

  // AEF-T2-Authorizations has many AEF-T4-Holdings
  AefT2AuthorizationsV2.hasMany(models.AefT4HoldingsV2, {
    foreignKey: 'cadTrustAefT2AuthorizationsId',
    as: 'holdings',
  });
};

export { AefT2AuthorizationsV2 };
