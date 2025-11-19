'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project', {
      cad_trust_project_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        unique: true,
        comment: 'generated UUID'
      },
      org_uid: {
        type: Sequelize.STRING(64),
        allowNull: false,
        comment: 'Organization UID - identifies which organization owns this project. Automatically set from home organization.'
      },
      project_registry_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      project_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      project_crediting_program: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      project_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      project_link: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      project_description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      project_sector: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      project_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      project_subtype: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      project_status: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      project_status_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      project_unit_metric: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cad_trust_reference_project_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      cad_trust_program_id: {
        type: Sequelize.STRING(36),
        allowNull: true,
        comment: 'Foreign key to program table'
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
    await queryInterface.addIndex('project', ['org_uid']);
    await queryInterface.addIndex('project', ['project_registry_name']);
    await queryInterface.addIndex('project', ['project_id']);
    await queryInterface.addIndex('project', ['project_name']);
    await queryInterface.addIndex('project', ['project_sector']);
    await queryInterface.addIndex('project', ['project_type']);
    await queryInterface.addIndex('project', ['project_status']);
    await queryInterface.addIndex('project', ['cad_trust_program_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('project');
  },
};
