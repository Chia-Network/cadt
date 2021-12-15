'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Qualifications', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      projectId: {
        type: Sequelize.NUMBER,
      },
      qualificationId: {
        type: Sequelize.NUMBER,
      },
      qualificationLink: {
        type: Sequelize.STRING,
      },
      type: {
        type: Sequelize.STRING,
      },
      label: {
        type: Sequelize.STRING,
      },
      creditingPeriodStartDate: {
        type: Sequelize.DATE,
      },
      creditingPeriodEndDate: {
        type: Sequelize.DATE,
      },
      validityStartDate: {
        type: Sequelize.DATE,
      },
      validityEndDate: {
        type: Sequelize.DATE,
      },
      unitQuantity: {
        type: Sequelize.NUMBER,
      },
      owner: {
        type: Sequelize.STRING,
      },
      unitId: {
        type: Sequelize.NUMBER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Qualifications');
  },
};
