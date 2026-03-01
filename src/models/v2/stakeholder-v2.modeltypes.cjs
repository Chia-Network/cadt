const Sequelize = require('sequelize');

module.exports = {
  cadTrustStakeholderId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
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
  orgUid: {
    type: Sequelize.STRING(64),
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
