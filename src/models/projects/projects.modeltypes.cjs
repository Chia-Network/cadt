const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  warehouseProjectId: {
    type: Sequelize.STRING,
    unique: true,
  },
  // The orgUid is the singeltonId of the
  // organizations tables on the datalayer
  orgUid: Sequelize.STRING,
  projectId: Sequelize.STRING,
  projectLocationId: Sequelize.NUMBER,
  currentRegistry: Sequelize.STRING,
  registryOfOrigin: Sequelize.STRING,
  originProjectId: Sequelize.STRING,
  program: Sequelize.STRING,
  projectName: Sequelize.STRING,
  projectLink: Sequelize.STRING,
  projectDeveloper: Sequelize.STRING,
  sector: Sequelize.STRING,
  projectType: Sequelize.STRING,
  coveredByNDC: Sequelize.INTEGER,
  NDCLinkage: Sequelize.STRING,
  projectStatus: Sequelize.STRING,
  projectStatusDate: Sequelize.DATE,
  unitMetric: Sequelize.STRING,
  methodology: Sequelize.STRING,
  methodologyVersion: Sequelize.NUMBER,
  validationApproach: Sequelize.STRING,
  validationDate: Sequelize.DATE,
  projectTag: Sequelize.STRING,
  estimatedAnnualAverageEmissionReduction: Sequelize.STRING,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
