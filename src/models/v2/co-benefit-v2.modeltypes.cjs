const Sequelize = require('sequelize');

module.exports = {
  cadTrustCoBenefitId: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  coBenefitId: {
    type: Sequelize.STRING,
    allowNull: false,
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
  cadTrustProjectId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
};
