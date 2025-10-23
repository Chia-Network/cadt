'use strict';

import { v4 as uuidv4 } from 'uuid';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project', {
      cad_trust_project_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'program',
          key: 'cad_trust_program_id',
        },
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
