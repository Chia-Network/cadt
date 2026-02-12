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
      aef_t5_authorized_entities_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      aef_t5_authorized_entities_cooperative_approach_id: {
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
    // Explicit short names used for columns where Sequelize's auto-generated
    // name ({table}_{column}) would exceed MySQL's 64-character identifier limit.
    // Each addIndex is individually wrapped in try/catch so that partial re-runs
    // (e.g. after a crash) can complete the remaining indexes.
    const indexes = [
      { cols: ['aef_t5_authorized_entities_authorization_date'], opts: { name: 'aef_t5_auth_entities_auth_date' } },
      { cols: ['aef_t5_authorized_entities_name'] },
      { cols: ['aef_t5_authorized_entities_incorporation_country'], opts: { name: 'aef_t5_auth_entities_incorp_country' } },
      { cols: ['cad_trust_aef_t1_submission_id'] },
      { cols: ['cad_trust_unit_id'] },
      { cols: ['cad_trust_project_id'] },
    ];
    for (const { cols, opts } of indexes) {
      try {
        await queryInterface.addIndex('aef_t5_authorized_entities', cols, opts);
      } catch {
        // Index may already exist from a partial previous run
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('aef_t5_authorized_entities');
  },
};
