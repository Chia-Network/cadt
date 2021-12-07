'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Projects', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      uuid: {
        type: Sequelize.STRING,
      },
      currentRegistry: {
        type: Sequelize.STRING,
      },
      registryOfOrigin: {
        type: Sequelize.STRING,
      },
      originProjectId: {
        type: Sequelize.NUMBER,
      },
      program: {
        type: Sequelize.STRING,
      },
      warehouseProjectId: {
        type: Sequelize.NUMBER,
      },
      projectName: {
        type: Sequelize.STRING,
      },
      projectLink: {
        type: Sequelize.STRING,
      },
      projectDeveloper: {
        type: Sequelize.STRING,
      },
      sector: {
        type: Sequelize.STRING,
      },
      projectType: {
        type: Sequelize.STRING,
      },
      coveredByNDC: {
        type: Sequelize.STRING,
      },
      NDCLinkage: {
        type: Sequelize.STRING,
      },
      projectStatus: {
        type: Sequelize.STRING,
      },
      projectStatusDate: {
        type: Sequelize.DATE,
      },
      unitMetric: {
        type: Sequelize.STRING,
      },
      methodology: {
        type: Sequelize.STRING,
      },
      methodologyVersion: {
        type: Sequelize.STRING,
      },
      validationApproach: {
        type: Sequelize.STRING,
      },
      validationDate: {
        type: Sequelize.DATE,
      },
      projectTag: {
        type: Sequelize.STRING,
      },
      estimatedAnnualAverageEmmisionReduction: {
        type: Sequelize.STRING,
      },
      owner: {
        type: Sequelize.STRING,
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
    await queryInterface.dropTable('Projects');
  },
};
