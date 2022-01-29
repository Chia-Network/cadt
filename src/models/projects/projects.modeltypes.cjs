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
  // Need to add 'originProjectID' field and make it a required field with type STRING. 
  // This field could be the exact same as 'projectID', but it could also be different. Both are required fields.
  program: {
    type: Sequelize.STRING,
    required: true,
    // 'program' field should be optional.
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
  // 'projectTags' should be an optional field. I could be misreading code here, just ensuring that the field is optional.
  coveredByNDC: {
    type: Sequelize.STRING,
    required: true,
  },
  ndcInformation: {
    type: Sequelize.STRING,
    required: true,
    // 'ndcInformation' field should be optional. 
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
