'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';

class AefT2AuthorizationsV2Mirror extends Model {
  static async create(values, options) {
    const result = await super.create(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    const result = await super.bulkCreate(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    const result = await super.update(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }
}

AefT2AuthorizationsV2Mirror.init(
  {
    cadTrustAefT2AuthorizationsId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_aef_t2_authorizations_id',
      defaultValue: Sequelize.UUIDV4,
    },
    aefT2AuthorizationsId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t2_authorizations_id',
    },
    aefT2AuthorizationsDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'aef_t2_authorizations_date',
    },
    aefT2AuthorizationsCooperativeApproachId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t2_authorizations_cooperative_approach_id',
    },
    aefT2AuthorizationsVersion: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_version',
    },
    aefT2AuthorizationsQuantity: {
      type: Sequelize.DECIMAL,
      allowNull: true,
      field: 'aef_t2_authorizations_quantity',
    },
    aefT2AuthorizationsMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_metric',
    },
    aefT2AuthorizationsGwpValue: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_gwp_value',
    },
    aefT2AuthorizationsApplicableNonGhgMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_applicable_non_ghg_metric',
    },
    aefT2AuthorizationsSector: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_sector',
    },
    aefT2AuthorizationsActivityType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_activity_type',
    },
    aefT2AuthorizationsPurposesForAuthorization: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_purposes_for_authorization',
    },
    aefT2AuthorizationsAuthorizedPartyId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t2_authorizations_authorized_party_id',
    },
    aefT2AuthorizationsAuthoziedEntityId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_authozied_entity_id',
    },
    aefT2AuthorizationsOimpAuthorizedParty: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_oimp_authorized_party',
    },
    aefT2AuthorizationsAuthorizedTimeframe: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_authorized_timeframe',
    },
    aefT2AuthorizationsAuthorizationTerms: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t2_authorizations_authorization_terms',
    },
    aefT2AuthorizationsAuthorizationDocumentation: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t2_authorizations_authorization_documentation',
    },
    aefT2AuthorizationsFirstTransferDefinitionOimp: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t2_authorizations_first_transfer_definition_oimp',
    },
    aefT2AuthorizationsAdditionalInformation: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'aef_t2_authorizations_additional_information',
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
    cadTrustAefT5AuthorizedEntitiesId: {
      type: Sequelize.UUID,
      allowNull: true,
      field: 'cad_trust_aef_t5_authorized_entities_id',
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
    modelName: 'AefT2AuthorizationsV2Mirror',
    tableName: 'aef_t2_authorizations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
  }
);

export { AefT2AuthorizationsV2Mirror };
