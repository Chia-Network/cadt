const Sequelize = require('sequelize');

module.exports = {
  cadTrustStakeholderProjectId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  cadTrustStakeholderId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  cadTrustProjectId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
};
