const Sequelize = require('sequelize');

module.exports = {
  cadTrustMethodologyId: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  methodologyCode: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  methodologyName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  methodologyVersion: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  methodologyDate: {
    type: Sequelize.DATEONLY,
    allowNull: true,
  },
  methodologyLink: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  methodologyType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
};
