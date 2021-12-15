const Sequelize = require('sequelize');

module.exports = {
  id: {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: Sequelize.INTEGER,
  },
  qualificationId: Sequelize.NUMBER,
  qualificationLink: Sequelize.STRING,
  projectId: Sequelize.NUMBER,
  type: Sequelize.STRING,
  label: Sequelize.STRING,
  creditingPeriodStartDate: Sequelize.DATE,
  creditingPeriodEndDate: Sequelize.DATE,
  unitId: Sequelize.NUMBER,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
