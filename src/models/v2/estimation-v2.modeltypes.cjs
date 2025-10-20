const Sequelize = require('sequelize');

module.exports = {
  cadTrustEstimationId: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
  },
  estimationStartDate: {
    type: Sequelize.DATE,
    allowNull: false,
  },
  estimationEndDate: {
    type: Sequelize.DATE,
    allowNull: false,
  },
  estimationUnitCount: {
    type: Sequelize.DECIMAL(20, 8),
    allowNull: true,
  },
  estimationReferenceNo: {
    type: Sequelize.STRING,
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
  cadTrustProjectId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
};
