const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  warehouseProjectId: {
    type: Sequelize.STRING,
    allowNull: false,
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
  originProjectId: {
    type: Sequelize.STRING,
    required: true,
  },
  registryOfOrigin: {
    type: Sequelize.STRING,
    required: true,
  },
  program: {
    type: Sequelize.STRING,
  },
  projectName: {
    type: Sequelize.STRING,
    required: true,
  },
  projectLink: {
    type: Sequelize.STRING(1000),
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
  projectTags: {
    type: Sequelize.STRING,
  },
  coveredByNDC: {
    type: Sequelize.STRING,
    required: true,
  },
  ndcInformation: {
    type: Sequelize.STRING,
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
  methodology2: {
    type: Sequelize.STRING,
  },
  validationBody: Sequelize.STRING,
  validationDate: Sequelize.DATE,
  timeStaged: {
    type: Sequelize.STRING,
  },
  description: {
    type: Sequelize.STRING,
    allowNull: true,
  },
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
