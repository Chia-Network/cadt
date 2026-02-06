'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('aef_t2_authorizations', {
      cad_trust_aef_t2_authorizations_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      aef_t2_authorizations_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t2_authorizations_date: {
        type: Sequelize.DATEONLY,
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
        type: Sequelize.DECIMAL(20, 6),
        allowNull: true,
      },
      aef_t2_authorizations_metric: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from metric'
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
        comment: 'picklist from sector'
      },
      aef_t2_authorizations_activity_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from type'
      },
      aef_t2_authorizations_purposes_for_authorization: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from purpose'
      },
      aef_t2_authorizations_authorized_party_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'inferred'
      },
      aef_t2_authorizations_authozied_entity_id: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'inferred'
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
        comment: 'html'
      },
      aef_t2_authorizations_first_transfer_definition_oimp: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      aef_t2_authorizations_additional_information: {
        type: Sequelize.TEXT,
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
      cad_trust_aef_t5_authorized_entities_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Foreign key to aef_t5_authorized_entities'
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
    await queryInterface.addIndex('aef_t2_authorizations', ['aef_t2_authorizations_date']);
    await queryInterface.addIndex('aef_t2_authorizations', ['aef_t2_authorizations_cooperative_approach_id']);
    await queryInterface.addIndex('aef_t2_authorizations', ['aef_t2_authorizations_sector']);
    await queryInterface.addIndex('aef_t2_authorizations', ['aef_t2_authorizations_activity_type']);
    await queryInterface.addIndex('aef_t2_authorizations', ['cad_trust_aef_t1_submission_id']);
    await queryInterface.addIndex('aef_t2_authorizations', ['cad_trust_unit_id']);
    await queryInterface.addIndex('aef_t2_authorizations', ['cad_trust_project_id']);
    await queryInterface.addIndex('aef_t2_authorizations', ['cad_trust_aef_t5_authorized_entities_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('aef_t2_authorizations');
  },
};
