'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'activity',
      {
        cad_trust_activity_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        activity_program_name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        activity_registry: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        activity_registry_activity_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        activity_registry_program_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        activity_description: {
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
    await queryInterface.dropTable('activity');
  },
};
