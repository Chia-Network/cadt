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
        org_uid: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: false,
        },
        org_hash: {
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
        registry_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        registry_hash: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        file_store_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        file_store_subscribed: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        subscribed: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        is_home: {
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
        data_model_version_store_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        data_model_version_store_hash: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        v2_registry_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        v2_registry_hash: {
          type: Sequelize.STRING,
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
    await queryInterface.dropTable('organizations');
  },
};
