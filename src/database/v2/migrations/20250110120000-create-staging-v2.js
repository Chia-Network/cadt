'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'staging',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        uuid: {
          type: Sequelize.STRING,
          unique: true,
        },
        table: {
          type: Sequelize.STRING,
        },
        action: {
          type: Sequelize.STRING,
        },
        data: {
          type: Sequelize.TEXT,
        },
        commited: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        failed_commit: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        is_transfer: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
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
    await queryInterface.dropTable('staging');
  },
};


