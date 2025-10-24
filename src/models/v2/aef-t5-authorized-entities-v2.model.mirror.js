'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class AefT5AuthorizedEntitiesV2Mirror extends Model {}

AefT5AuthorizedEntitiesV2Mirror.init(
  {
    cadTrustAefT5AuthorizedEntitiesId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_aef_t5_authorized_entities_id',
      defaultValue: Sequelize.UUIDV4,
    },
    aefT5AuthorizedEntitiesAuthorizationDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'aef_t5_authorized_entities_authorization_date',
    },
    aefT5AuthorizedEntitiesName: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t5_authorized_entities_name',
    },
    aefT5AuthorizedEntitiesIncorporationCountry: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t5_authorized_entities_incorporation_country',
    },
    aefT5AuthorizedEntitiesId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t5_authorized_entities_Id',
    },
    aefT5AuthorizedEntitiesCooperativeApproachId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t5_authorized_entities_cooperative_approach_Id',
    },
    aefT5AuthorizedEntitiesConditions: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t5_authorized_entities_conditions',
    },
    aefT5AuthorizedEntitiesChangeConditions: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t5_authorized_entities_change_conditions',
    },
    aefT5AuthorizedEntitiesAdditionalInformation: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t5_authorized_entities_additional_information',
    },
    cadTrustAefT1SubmissionId: {
      type: Sequelize.UUID,
      allowNull: true,
      field: 'cad_trust_aef_t1_submission_id',
    },
    cadTrustUnitId: {
      type: Sequelize.UUID,
      allowNull: true,
      field: 'cad_trust_unit_id',
    },
    cadTrustProjectId: {
      type: Sequelize.UUID,
      allowNull: true,
      field: 'cad_trust_project_id',
    },
    cadTrustAefT2AuthorizationsId: {
      type: Sequelize.UUID,
      allowNull: true,
      field: 'cad_trust_aef_t2_authorizations_id',
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: Sequelize.NOW,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: Sequelize.NOW,
    },
  },
  {
    sequelize: sequelizeV2,
    modelName: 'AefT5AuthorizedEntitiesV2Mirror',
    tableName: 'aef_t5_authorized_entities',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { AefT5AuthorizedEntitiesV2Mirror };
