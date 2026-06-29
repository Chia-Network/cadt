'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('aef_t4_holdings', {
      cad_trust_aef_t4_holdings_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      aef_t4_holdings_cooperative_approach_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t4_holdings_authorization_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'inferred'
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
        comment: 'inferred'
      },
      aef_t4_holdings_unit_last_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'inferred'
      },
      aef_t4_holdings_metric: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from metric'
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
        type: Sequelize.DECIMAL(20, 6),
        allowNull: false,
        comment: 'inferred'
      },
      aef_t4_holdings_quantity_non_ghg: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t4_holdings_mitigation_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'inferred, picklist from type'
      },
      aef_t4_holdings_vintage_year: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'inferred'
      },
      cad_trust_aef_t1_submission_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Foreign key to aef_t1_submission'
      },
      cad_trust_unit_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Foreign key to unit'
      },
      cad_trust_project_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Foreign key to project'
      },
      cad_trust_aef_t2_authorizations_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Foreign key to aef_t2_authorizations'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex('aef_t4_holdings', ['aef_t4_holdings_cooperative_approach_id']);
    await queryInterface.addIndex('aef_t4_holdings', ['aef_t4_holdings_authorization_id']);
    await queryInterface.addIndex('aef_t4_holdings', ['aef_t4_holdings_vintage_year']);
    await queryInterface.addIndex('aef_t4_holdings', ['cad_trust_aef_t1_submission_id']);
    await queryInterface.addIndex('aef_t4_holdings', ['cad_trust_unit_id']);
    await queryInterface.addIndex('aef_t4_holdings', ['cad_trust_project_id']);
    await queryInterface.addIndex('aef_t4_holdings', ['cad_trust_aef_t2_authorizations_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('aef_t4_holdings');
  },
};
