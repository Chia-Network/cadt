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
      warehouseProjectId: {
        type: Sequelize.STRING,
      },
      projectID: {
        type: Sequelize.STRING,
      },
      currentRegistry: {
        type: Sequelize.STRING,
      },
      registryOfOrigin: {
        type: Sequelize.STRING,
      },
      originProjectId: {
        type: Sequelize.STRING,
      },
      program: {
        type: Sequelize.STRING,
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
        type: Sequelize.INTEGER,
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
        type: Sequelize.NUMBER,
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
      estimatedAnnualAverageEmissionReduction: {
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
