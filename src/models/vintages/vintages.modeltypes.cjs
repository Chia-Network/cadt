const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.NUMBER,
    primaryKey: true,
  },
  startDate: Sequelize.DATE,
  endDate: Sequelize.DATE,
  verificationApproach: Sequelize.STRING,
  verificationDate: Sequelize.DATE,
  verificationBody: Sequelize.STRING,
  projectId: Sequelize.NUMBER,
  unitId: Sequelize.NUMBER,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
