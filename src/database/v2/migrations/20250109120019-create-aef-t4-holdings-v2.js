'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'aef_t4_holdings',
      {
        cad_trust_aef_t4_holdings_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: () => uuidv4(),
        },
        aef_t4_holdings_coopoerative_approach_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_authorization_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_first_transferring_party_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_party_itmo_registry_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_itmo_first_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_itmo_last_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_unit_registry_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_unit_first_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_unit_last_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aef_t4_holdings_metric: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t4_holdings_gwp_value: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t4_holdings_applicable_non_ghg_metric: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t4_holdings_quantity_t_co2: {
          type: Sequelize.DECIMAL(20, 8),
          allowNull: false,
        },
        aef_t4_holdings_quantity_non_ghg: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t4_holdings_mitigation_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        aef_t4_holdings_vintage_year: {
          type: Sequelize.INTEGER,
          allowNull: false,
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
        cad_trust_aef_t2_authorizations_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'aef_t2_authorizations',
            key: 'cad_trust_aef_t2_authorizations_id',
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
    await queryInterface.dropTable('aef_t4_holdings');
  },
};
