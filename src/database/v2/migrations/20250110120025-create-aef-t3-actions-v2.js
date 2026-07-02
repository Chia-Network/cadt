'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('aef_t3_actions', {
      cad_trust_aef_t3_actions_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      aef_t3_actions_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      aef_t3_actions_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from type'
      },
      aef_t3_actions_subtype: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t3_actions_cooperative_approach_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t3_actions_authorization_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'inferred'
      },
      aef_t3_actions_first_transferring_party_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t3_actions_party_itmo_registry_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t3_actions_itmo_first_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t3_actions_itmo_last_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t3_actions_unit_registry_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t3_actions_unit_first_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'inferred'
      },
      aef_t3_actions_unit_last_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'inferred'
      },
      aef_t3_actions_metric: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from metric'
      },
      aef_t3_actions_gwp_value: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t3_actions_applicable_non_ghg_metric: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t3_actions_quantity_t_co2: {
        type: Sequelize.DECIMAL(20, 6),
        allowNull: false,
        comment: 'inferred'
      },
      aef_t3_actions_quantity_non_ghg: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t3_actions_mitigation_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from type, inferred'
      },
      aef_t3_actions_vintage_year: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'inferred'
      },
      aef_t3_actions_transferring_party_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t3_actions_acquiring_party_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t3_actions_purpose_of_use_oimp: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t3_actions_using_participating_party_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t3_actions_using_authorized_entity_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t3_actions_itmo_used_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      aef_t3_actions_consistency_check_result: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      aef_t3_actions_additional_information: {
        type: Sequelize.STRING,
        allowNull: true,
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
    await queryInterface.addIndex('aef_t3_actions', ['aef_t3_actions_date']);
    await queryInterface.addIndex('aef_t3_actions', ['aef_t3_actions_type']);
    await queryInterface.addIndex('aef_t3_actions', ['aef_t3_actions_cooperative_approach_id']);
    await queryInterface.addIndex('aef_t3_actions', ['aef_t3_actions_authorization_id']);
    await queryInterface.addIndex('aef_t3_actions', ['aef_t3_actions_vintage_year']);
    await queryInterface.addIndex('aef_t3_actions', ['cad_trust_aef_t1_submission_id']);
    await queryInterface.addIndex('aef_t3_actions', ['cad_trust_unit_id']);
    await queryInterface.addIndex('aef_t3_actions', ['cad_trust_project_id']);
    await queryInterface.addIndex('aef_t3_actions', ['cad_trust_aef_t2_authorizations_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('aef_t3_actions');
  },
};
