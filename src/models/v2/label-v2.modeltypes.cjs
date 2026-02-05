const Sequelize = require('sequelize');

module.exports = {
  cadTrustLabelId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
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
    type: Sequelize.DATEONLY,
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
