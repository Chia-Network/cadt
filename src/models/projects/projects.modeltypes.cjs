const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  warehouseProjectId: {
    type: Sequelize.STRING,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  // The orgUid is the singeltonId of the
  // organizations tables on the datalayer
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  currentRegistry: {
    type: Sequelize.STRING,
    required: true,
  },
  projectId: {
    type: Sequelize.STRING,
    required: true,
  },
  registryOfOrigin: {
    type: Sequelize.STRING,
    required: true,
  },
  program: {
    type: Sequelize.STRING,
    required: true,
  },
  projectName: {
    type: Sequelize.STRING,
    required: true,
  },
  projectLink: {
    type: Sequelize.STRING,
    required: true,
  },
  projectDeveloper: {
    type: Sequelize.STRING,
    required: true,
  },
  sector: {
    type: Sequelize.STRING,
    required: true,
  },
  projectType: {
    type: Sequelize.STRING,
    required: true,
  },
  projectTags: Sequelize.STRING,
  coveredByNDC: {
    type: Sequelize.STRING,
    required: true,
  },
  ndcInformation: {
    type: Sequelize.STRING,
    required: true,
  },
  projectStatus: {
    type: Sequelize.STRING,
    required: true,
  },
  projectStatusDate: {
    type: Sequelize.DATE,
    required: true,
  },
  unitMetric: {
    type: Sequelize.STRING,
    required: true,
  },
  methodology: {
    type: Sequelize.STRING,
    required: true,
  },
  validationBody: Sequelize.STRING,
  validationDate: Sequelize.DATE,
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
};
