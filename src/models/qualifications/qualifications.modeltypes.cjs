const Sequelize = require('sequelize');

module.exports = {
  id: {
    autoIncrement: true,
    primaryKey: true,
    type: Sequelize.INTEGER,
  },
  qualificationId: Sequelize.INTEGER,
  qualificationLink: Sequelize.STRING,
  projectId: Sequelize.INTEGER,
  type: Sequelize.STRING,
  label: Sequelize.STRING,
  creditingPeriodStartDate: Sequelize.DATE,
  creditingPeriodEndDate: Sequelize.DATE,
  unitId: Sequelize.INTEGER,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
