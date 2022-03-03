const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  warehouseProjectId: {
    type: Sequelize.STRING,
    required: true,
  },
  startDate: {
    type: Sequelize.DATE,
    required: true,
  },
  endDate: {
    type: Sequelize.DATE,
    required: true,
  },
  verificationApproach: {
    type: Sequelize.STRING,
    required: true,
  },
  verificationReportDate: {
    type: Sequelize.DATE,
    required: true,
  },
  verificationBody: {
    type: Sequelize.STRING,
    required: true,
  },
  timeStaged: {
    type: 'TIMESTAMP',
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
