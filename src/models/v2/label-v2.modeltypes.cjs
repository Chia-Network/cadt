const Sequelize = require('sequelize');

module.exports = {
  cadTrustLabelId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  labelName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  labelType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  labelLink: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  labelDate: {
    type: Sequelize.DATE,
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
