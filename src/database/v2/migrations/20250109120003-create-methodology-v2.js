'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'methodology',
      {
        cad_trust_methodology_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: () => uuidv4(),
        },
        methodology_code: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        methodology_name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        methodology_version: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        methodology_date: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        methodology_link: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        methodology_type: {
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
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('methodology');
  },
};
