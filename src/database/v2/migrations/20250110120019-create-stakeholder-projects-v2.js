'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stakeholder_projects', {
      cad_trust_stakeholder_project_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      cad_trust_stakeholder_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Foreign key to stakeholder table'
      },
      cad_trust_project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Foreign key to project table'
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
    await queryInterface.addIndex('stakeholder_projects', ['cad_trust_stakeholder_id']);
    await queryInterface.addIndex('stakeholder_projects', ['cad_trust_project_id']);

    // Add unique constraint to prevent duplicate stakeholder-project relationships
    await queryInterface.addConstraint('stakeholder_projects', {
      fields: ['cad_trust_stakeholder_id', 'cad_trust_project_id'],
      type: 'unique',
      name: 'stakeholder_projects_unique_constraint'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('stakeholder_projects');
  },
};
