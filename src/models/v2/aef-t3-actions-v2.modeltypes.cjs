const Sequelize = require('sequelize');

module.exports = {
  cadTrustAefT3ActionsId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  aefT3ActionsId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aefT3ActionsType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsMetric: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  aefT3ActionsMitigationType: {
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
