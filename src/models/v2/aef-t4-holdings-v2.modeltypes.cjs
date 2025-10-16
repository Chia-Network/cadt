const Sequelize = require('sequelize');

module.exports = {
  cadTrustAefT4HoldingsId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  aefT4HoldingsId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT4HoldingsMetric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT4HoldingsMitigationType: {
    type: Sequelize.STRING,
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
