'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orgUid: {
        type: Sequelize.STRING,
        required: true,
        allowNull: false,
      },
      registryId: {
        type: Sequelize.STRING,
        required: true,
        allowNull: false,
      },
      rootHash: {
        type: Sequelize.STRING,
        required: true,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        required: true,
        allowNull: false,
      },
      change: {
        type: Sequelize.TEXT,
        required: true,
        allowNull: true,
      },
      table: {
        type: Sequelize.STRING,
        required: true,
        allowNull: true,
      },
      onchainConfirmationTimeStamp: {
        type: Sequelize.STRING,
        required: true,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit');
  },
};
