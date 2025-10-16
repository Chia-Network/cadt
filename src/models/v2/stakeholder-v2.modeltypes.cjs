const Sequelize = require('sequelize');

module.exports = {
  cadTrustStakeholderId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  stakeholderName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  stakeholderType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  stakeholderLink: {
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
