'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('aef_t1_submission', {
      cad_trust_aef_t1_submission_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      aef_t1_submission_party: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t1_submission_version: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aef_t1_submission_report_year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      aef_t1_submission_submission_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      aef_t1_submission_review_status: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      aef_t1_submission_result_check: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      aef_t1_submission_ndc_first_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      aef_t1_submission_ndc_last_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      aef_t1_submission_reference_review_report: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'URL'
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
    await queryInterface.addIndex('aef_t1_submission', ['aef_t1_submission_party']);
    await queryInterface.addIndex('aef_t1_submission', ['aef_t1_submission_version']);
    await queryInterface.addIndex('aef_t1_submission', ['aef_t1_submission_report_year']);
    await queryInterface.addIndex('aef_t1_submission', ['aef_t1_submission_submission_date']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('aef_t1_submission');
  },
};
