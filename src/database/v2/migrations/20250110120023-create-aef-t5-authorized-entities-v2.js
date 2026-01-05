'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('aef_t5_authorized_entities', {
      cad_trust_aef_t5_authorized_entities_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      aef_t5_authorized_entities_authorization_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      aef_t5_authorized_entities_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t5_authorized_entities_incorporation_country: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'picklist from country'
      },
      aef_t5_authorized_entities_Id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t5_authorized_entities_cooperative_approach_Id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t5_authorized_entities_conditions: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      aef_t5_authorized_entities_change_conditions: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      aef_t5_authorized_entities_additional_information: {
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
    await queryInterface.addIndex('aef_t5_authorized_entities', ['aef_t5_authorized_entities_authorization_date']);
    await queryInterface.addIndex('aef_t5_authorized_entities', ['aef_t5_authorized_entities_name']);
    await queryInterface.addIndex('aef_t5_authorized_entities', ['aef_t5_authorized_entities_incorporation_country']);
    await queryInterface.addIndex('aef_t5_authorized_entities', ['cad_trust_aef_t1_submission_id']);
    await queryInterface.addIndex('aef_t5_authorized_entities', ['cad_trust_unit_id']);
    await queryInterface.addIndex('aef_t5_authorized_entities', ['cad_trust_project_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('aef_t5_authorized_entities');
  },
};
