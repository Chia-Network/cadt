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
  projectId: Sequelize.INTEGER,
  type: Sequelize.STRING,
  label: Sequelize.STRING,
  creditingPeriodStartDate: Sequelize.DATE,
  creditingPeriodEndDate: Sequelize.DATE,
  unitId: Sequelize.INTEGER,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
