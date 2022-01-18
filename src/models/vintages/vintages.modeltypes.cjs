const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.STRING,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  startDate: Sequelize.DATE,
  endDate: Sequelize.DATE,
  verificationApproach: Sequelize.STRING,
  verificationDate: Sequelize.DATE,
  verificationBody: Sequelize.STRING,
  warehouseProjectId: Sequelize.STRING,
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
