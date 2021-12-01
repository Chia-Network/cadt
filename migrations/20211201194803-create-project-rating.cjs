'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ProjectRatings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      ratingType: {
        type: Sequelize.STRING
      },
      rating: {
        type: Sequelize.NUMBER
      },
      link: {
        type: Sequelize.STRING
      },
      scale: {
        type: Sequelize.STRING
      },
      owner: {
        type: Sequelize.STRING
      },
      projectId: {
        type: Sequelize.NUMBER
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
    await queryInterface.dropTable('ProjectRatings');
  }
};