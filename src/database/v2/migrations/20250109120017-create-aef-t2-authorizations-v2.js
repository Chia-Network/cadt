'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'aef_t2_authorizations',
      {
        cad_trust_aef_t2_authorizations_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        aef_t2_authorizations_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t2_authorizations_date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        aef_t2_authorizations_cooperative_approach_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t2_authorizations_version: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_quantity: {
          type: Sequelize.DECIMAL(20, 8),
          allowNull: true,
        },
        aef_t2_authorizations_metric: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_gwp_value: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_applicable_non_ghg_metric: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_sector: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_activity_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_purposes_for_authorization: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_authorized_party_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t2_authorizations_authozied_entity_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_oimp_authorized_party: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_authorized_timeframe: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_authorization_terms: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t2_authorizations_authorization_documentation: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        aef_t2_authorizations_first_transfer_definition_oimp: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        aef_t2_authorizations_additional_information: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false,
        },
        cad_trust_aef_t1_submission_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'aef_t1_submission',
            key: 'cad_trust_aef_t1_submission_id',
          },
        },
        cad_trust_unit_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'unit',
            key: 'cad_trust_unit_id',
          },
        },
        cad_trust_project_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'project',
            key: 'cad_trust_project_id',
          },
        },
        cad_trust_aef_t5_authorized_entities_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'aef_t5_authorized_entities',
            key: 'cad_trust_aef_t5_authorized_entities_id',
          },
        },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('aef_t2_authorizations');
  },
};
