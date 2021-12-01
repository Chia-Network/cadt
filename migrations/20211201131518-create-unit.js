'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Units', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      owner: {
        type: Sequelize.STRING
      },
      buyer: {
        type: Sequelize.STRING
      },
      registry: {
        type: Sequelize.STRING
      },
      blockIdentifier: {
        type: Sequelize.STRING
      },
      identifier: {
        type: Sequelize.STRING
      },
      qualificationId: {
        type: Sequelize.NUMBER
      },
      unitType: {
        type: Sequelize.STRING
      },
      unitCount: {
        type: Sequelize.NUMBER
      },
      unitStatus: {
        type: Sequelize.STRING
      },
      unitStatusDate: {
        type: Sequelize.DATE
      },
      transactionType: {
        type: Sequelize.STRING
      },
      unitIssuanceLocation: {
        type: Sequelize.STRING
      },
      unitLink: {
        type: Sequelize.STRING
      },
      correspondingAdjustment: {
        type: Sequelize.STRING
      },
      unitTag: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Units');
  }
};