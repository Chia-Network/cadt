'use strict';

import { Sequelize, Model } from 'sequelize';
import { sequelizeV2Mirror, initMirrorModelV2 } from '../../database/v2/index.js';

class AefT4HoldingsV2Mirror extends Model {}

initMirrorModelV2(() => {
  AefT4HoldingsV2Mirror.init(
  {
    cadTrustAefT4HoldingsId: {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
      unique: true,
      field: 'cad_trust_aef_t4_holdings_id',
      defaultValue: Sequelize.UUIDV4,
    },
    aefT4HoldingsCooperativeApproachId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_cooperative_approach_id',
    },
    aefT4HoldingsAuthorizationId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_authorization_id',
    },
    aefT4HoldingsFirstTransferringPartyId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_first_transferring_party_id',
    },
    aefT4HoldingsPartyItmoRegistryId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_party_itmo_registry_id',
    },
    aefT4HoldingsItmoFirstId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_itmo_first_id',
    },
    aefT4HoldingsItmoLastId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_itmo_last_id',
    },
    aefT4HoldingsUnitRegistryId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_unit_registry_id',
    },
    aefT4HoldingsUnitFirstId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_unit_first_id',
    },
    aefT4HoldingsUnitLastId: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'aef_t4_holdings_unit_last_id',
    },
    aefT4HoldingsMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t4_holdings_metric',
    },
    aefT4HoldingsGwpValue: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t4_holdings_gwp_value',
    },
    aefT4HoldingsApplicableNonGhgMetric: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t4_holdings_applicable_non_ghg_metric',
    },
    aefT4HoldingsQuantityTCo2: {
      type: Sequelize.DECIMAL(20, 6),
      allowNull: false,
      field: 'aef_t4_holdings_quantity_t_co2',
    },
    aefT4HoldingsQuantityNonGhg: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t4_holdings_quantity_non_ghg',
    },
    aefT4HoldingsMitigationType: {
      type: Sequelize.STRING,
      allowNull: true,
      field: 'aef_t4_holdings_mitigation_type',
    },
    aefT4HoldingsVintageYear: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'aef_t4_holdings_vintage_year',
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
    createdByOrgUid: {
      type: Sequelize.STRING(64),
      allowNull: true,
      field: 'created_by_org_uid',
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
      modelName: 'AefT4HoldingsV2Mirror',
      tableName: 'aef_t4_holdings',
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

export { AefT4HoldingsV2Mirror };
