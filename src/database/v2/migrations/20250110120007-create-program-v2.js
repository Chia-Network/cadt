'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('program', {
      cad_trust_program_id: {
        type: Sequelize.TEXT,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      program_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      program_registry: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      program_registry_activity_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      program_registry_program_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      program_description: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.addIndex('program', ['program_name']);
    await queryInterface.addIndex('program', ['program_registry']);
    await queryInterface.addIndex('program', ['program_registry_activity_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('program');
  },
};
