const Sequelize = require('sequelize');

module.exports = {
  cadTrustLabelId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  cadTrustUnitId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  labelUnitDate: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  labelUnitDescription: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
};
