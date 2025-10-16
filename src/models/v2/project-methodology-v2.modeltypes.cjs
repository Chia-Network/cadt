const Sequelize = require('sequelize');

module.exports = {
  cadTrustProjectId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  cadTrustMethodologyId: {
    type: Sequelize.INTEGER,
    allowNull: false,
    primaryKey: true,
  },
  projectMethodologyDate: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  projectMethodologyDescription: {
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
