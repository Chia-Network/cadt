const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.STRING,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  warehouseProjectId: {
    type: Sequelize.STRING,
    required: true,
  },
  label: {
    type: Sequelize.STRING,
    require: true,
  },
  creditingPeriodStartDate: {
    type: Sequelize.DATE,
    require: true,
  },
  creditingPeriodEndDate: {
    type: Sequelize.DATE,
    require: true,
  },
  validityStartDate: {
    type: Sequelize.DATE,
    require: true,
  },
  validityPeriodEndDate: {
    type: Sequelize.DATE,
    require: true,
  },
  unitQuantity: {
    type: Sequelize.INTEGER,
    require: true,
  },
  labelLink: {
    type: Sequelize.STRING,
    require: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
