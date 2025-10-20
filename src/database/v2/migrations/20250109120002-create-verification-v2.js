'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'verification',
      {
        cad_trust_verification_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: () => uuidv4(),
        },
        verification_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        verification_start_date: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        verification_end_date: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        verification_body: {
          type: Sequelize.STRING,
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
        cad_trust_project_id: {
          type: Sequelize.STRING,
          allowNull: false,
          references: {
            model: 'project',
            key: 'cad_trust_project_id',
          },
        },
        cad_trust_validation_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'validation',
            key: 'cad_trust_validation_id',
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
    await queryInterface.dropTable('verification');
  },
};
