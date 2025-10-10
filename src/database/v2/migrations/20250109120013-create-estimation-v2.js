'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'estimation',
      {
        cad_trust_estimation_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        estimation_start_date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        estimation_end_date: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        estimation_unit_count: {
          type: Sequelize.DECIMAL(20, 8),
          allowNull: true,
        },
        estimation_reference_no: {
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
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'project',
            key: 'cad_trust_project_id',
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
    await queryInterface.dropTable('estimation');
  },
};
