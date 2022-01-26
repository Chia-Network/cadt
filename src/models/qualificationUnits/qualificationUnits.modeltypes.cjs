const Sequelize = require('sequelize');

module.exports = {
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  warehouseUnitId: Sequelize.STRING,
  qualificationId: Sequelize.STRING,
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
