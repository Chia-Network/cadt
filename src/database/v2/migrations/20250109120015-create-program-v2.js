'use strict';

import { uuid as uuidv4 } from 'uuidv4';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'program',
      {
        cad_trust_program_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          defaultValue: () => uuidv4(),
        },
        program_name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        program_registry: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        program_registry_program_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        program_registry_activity_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        program_description: {
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
    await queryInterface.dropTable('program');
  },
};
