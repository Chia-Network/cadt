'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_methodology', {
      cad_trust_project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        comment: 'Foreign key to project table'
      },
      cad_trust_methodology_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        comment: 'references methodology UUID'
      },
      project_methodology_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      project_methodology_description: {
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
    await queryInterface.addIndex('project_methodology', ['cad_trust_project_id']);
    await queryInterface.addIndex('project_methodology', ['cad_trust_methodology_id']);
    await queryInterface.addIndex('project_methodology', ['project_methodology_date']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('project_methodology');
  },
};
