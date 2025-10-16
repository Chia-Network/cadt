'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'organizations',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        orgUid: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: false,
        },
        orgHash: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        icon: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        registryId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        registryHash: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        fileStoreId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        fileStoreSubscribed: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        subscribed: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        isHome: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        metadata: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: '{}',
        },
        synced: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        sync_remaining: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        dataModelVersionStoreId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        dataModelVersionStoreHash: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        v2RegistryId: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        v2RegistryHash: {
          type: Sequelize.STRING,
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
    await queryInterface.dropTable('organizations');
  },
};

