'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'aef_t1_submission',
      {
        cad_trust_aef_t1_submission_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: () => uuidv4(),
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
          type: Sequelize.DATE,
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
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('aef_t1_submission');
  },
};
