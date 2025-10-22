'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'meta',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        meta_key: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: false,
        },
        meta_value: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_general_ci',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('meta');
  },
};

