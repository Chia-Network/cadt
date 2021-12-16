const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  startDate: Sequelize.DATE,
  endDate: Sequelize.DATE,
  verificationApproach: Sequelize.STRING,
  verificationDate: Sequelize.DATE,
  verificationBody: Sequelize.STRING,
  projectId: Sequelize.INTEGER,
  unitId: Sequelize.INTEGER,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
