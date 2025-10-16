'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'audit',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        orgUid: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        registryId: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        rootHash: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        change: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        table: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        onchainConfirmationTimeStamp: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        author: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        comment: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        generation: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
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
    await queryInterface.dropTable('audit');
  },
};

