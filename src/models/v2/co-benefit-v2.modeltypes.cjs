const Sequelize = require('sequelize');

module.exports = {
  cadTrustCoBenefitId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
  },
  coBenefitId: {
    type: Sequelize.STRING,
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
