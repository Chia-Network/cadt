const Sequelize = require('sequelize');

module.exports = {
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  warehouseUnitId: {
    type: Sequelize.STRING,
    required: true,
  },
  labelId: {
    type: Sequelize.STRING,
    required: true,
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
