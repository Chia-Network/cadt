const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.STRING,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  qualificationId: Sequelize.INTEGER,
  qualificationLink: Sequelize.STRING,
  warehouseProjectId: Sequelize.INTEGER,
  type: Sequelize.STRING,
  label: Sequelize.STRING,
  creditingPeriodStartDate: Sequelize.DATE,
  creditingPeriodEndDate: Sequelize.DATE,
  warehouseUnitId: Sequelize.INTEGER,
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
