'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './aef-t1-submission-v2.modeltypes.cjs';

class AefT1SubmissionV2 extends Model {}

AefT1SubmissionV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AefT1SubmissionV2',
  tableName: 'aef_t1_submission',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

// Define associations
AefT1SubmissionV2.associate = (models) => {
  // AEF-T1-Submission has many AEF-T5-Authorized-Entities
  AefT1SubmissionV2.hasMany(models.AefT5AuthorizedEntitiesV2, {
    foreignKey: 'cadTrustAefT1SubmissionId',
    as: 'authorizedEntities',
  });

  // AEF-T1-Submission associations will be added when other AEF models are implemented
  // AefT1SubmissionV2.hasMany(models.AefT2AuthorizationsV2, {
  //   foreignKey: 'cadTrustAefT1SubmissionId',
  //   as: 'authorizations',
  // });
  // AefT1SubmissionV2.hasMany(models.AefT3ActionsV2, {
  //   foreignKey: 'cadTrustAefT1SubmissionId',
  //   as: 'actions',
  // });
  // AefT1SubmissionV2.hasMany(models.AefT4HoldingsV2, {
  //   foreignKey: 'cadTrustAefT1SubmissionId',
  //   as: 'holdings',
  // });
};

export { AefT1SubmissionV2 };
