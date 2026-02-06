const Sequelize = require('sequelize');

module.exports = {
  cadTrustStakeholderProjectId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  cadTrustStakeholderId: {
    type: Sequelize.UUID,
    allowNull: false,
  },
  cadTrustProjectId: {
    type: Sequelize.UUID,
    allowNull: false,
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
