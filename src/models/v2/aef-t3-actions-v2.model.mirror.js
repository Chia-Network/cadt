'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';

class AefT3ActionsV2Mirror extends Model {}

safeMirrorDbHandlerV2(() => {
  AefT3ActionsV2Mirror.init(
  {
    cadTrustAefT3ActionsId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_aef_t3_actions_id',
      defaultValue: Sequelize.UUIDV4,
    },
    aefT3ActionsDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'aef_t3_actions_date',
    },
    aefT3ActionsType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_type',
    },
    aefT3ActionsSubtype: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_subtype',
    },
    aefT3ActionsCoopoerativeApproachId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_coopoerative_approach_id',
    },
    aefT3ActionsAuthorizationId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_authorization_id',
    },
    aefT3ActionsFirstTransferringPartyId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_first_transferring_party_id',
    },
    aefT3ActionsPartyItmoRegistryId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_party_itmo_registry_id',
    },
    aefT3ActionsItmoFirstId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_itmo_first_id',
    },
    aefT3ActionsItmoLastId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_itmo_last_id',
    },
    aefT3ActionsUnitRegistryId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_unit_registry_id',
    },
    aefT3ActionsUnitFirstId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_unit_first_id',
    },
    aefT3ActionsUnitLastId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_unit_last_id',
    },
    aefT3ActionsMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_metric',
    },
    aefT3ActionsGwpValue: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_gwp_value',
    },
    aefT3ActionsApplicableNonGhgMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_applicable_non_ghg_metric',
    },
    aefT3ActionsQuantityTCo2: {
      type: Sequelize.DECIMAL,
      allowNull: false,
      field: 'aef_t3_actions_quantity_t_co2',
    },
    aefT3ActionsQuantityNonGhg: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_quantity_non_ghg',
    },
    aefT3ActionsMitigationType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_mitigation_type',
    },
    aefT3ActionsVintageYear: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'aef_t3_actions_vintage_year',
    },
    aefT3ActionsTransferringPartyId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_transferring_party_id',
    },
    aefT3ActionsAcquiringPartyId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t3_actions_acquiring_party_id',
    },
    aefT3ActionsPurposeOfUseOimp: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_purpose_of_use_oimp',
    },
    aefT3ActionsUsingParticipatingPartyId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_using_participating_party_id',
    },
    aefT3ActionsUsingAuthorizedEntityId: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_using_authorized_entity_id',
    },
    aefT3ActionsItmoUsedYear: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'aef_t3_actions_itmo_used_year',
    },
    aefT3ActionsConsistencyCheckResult: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_consistency_check_result',
    },
    aefT3ActionsAdditionalInformation: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t3_actions_additional_information',
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
      sequelize: sequelizeV2Mirror,
      modelName: 'AefT3ActionsV2Mirror',
      tableName: 'aef_t3_actions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      timezone: '+00:00',
      define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
      dialectOptions: {
        charset: 'utf8mb4',
        dateStrings: true,
        typeCast: true,
      },
    }
  );
});

export { AefT3ActionsV2Mirror };
