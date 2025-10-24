'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t5-authorized-entities-v2.modeltypes.cjs';

class AefT5AuthorizedEntitiesV2 extends Model {}

AefT5AuthorizedEntitiesV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT5AuthorizedEntitiesV2',
  tableName: 'aef_t5_authorized_entities',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT5AuthorizedEntitiesV2.associate = (models) => {
  // AEF-T5-Authorized-Entities belongs to AEF-T1-Submission
  AefT5AuthorizedEntitiesV2.belongsTo(models.AefT1SubmissionV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'aefT1Submission',
  });

  // AEF-T5-Authorized-Entities belongs to Unit
  AefT5AuthorizedEntitiesV2.belongsTo(models.UnitV2, {
    foreignKey: 'cadTrustUnitId',
    as: 'unit',
  });

  // AEF-T5-Authorized-Entities belongs to Project
  AefT5AuthorizedEntitiesV2.belongsTo(models.ProjectV2, {
    foreignKey: 'cadTrustProjectId',
    as: 'project',
  });

  // AEF-T5-Authorized-Entities has many AEF-T2-Authorizations
  AefT5AuthorizedEntitiesV2.hasMany(models.AefT2AuthorizationsV2, {
    foreignKey: 'cadTrustAefT5AuthorizedEntitiesId',
    as: 'authorizations',
  });

  // AEF-T5-Authorized-Entities associations will be added when AEF-T2-Authorizations is implemented
  // AefT5AuthorizedEntitiesV2.belongsTo(models.AefT2AuthorizationsV2, {
  //   foreignKey: 'cadTrustAefT2AuthorizationsId',
  //   as: 'aefT2Authorizations',
  // });
};

export { AefT5AuthorizedEntitiesV2 };
