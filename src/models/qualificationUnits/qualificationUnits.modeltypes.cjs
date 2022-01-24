const Sequelize = require('sequelize');

module.exports = {
  warehouseUnitId: Sequelize.STRING,
  qualificationId: Sequelize.STRING,
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
