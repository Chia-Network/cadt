'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'project',
      {
        cad_trust_project_id: {
          type: Sequelize.STRING,
          primaryKey: true,
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
          type: Sequelize.DATE,
          allowNull: true,
        },
        project_unit_metric: {
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
        cad_trust_reference_project_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        cad_trust_program_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('project');
  },
};
