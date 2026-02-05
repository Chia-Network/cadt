const Sequelize = require('sequelize');

module.exports = {
  cadTrustEstimationId: {
    type: Sequelize.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4,
  },
  estimationStartDate: {
    type: Sequelize.DATEONLY,
    allowNull: false,
  },
  estimationEndDate: {
    type: Sequelize.DATEONLY,
    allowNull: false,
  },
  estimationUnitCount: {
    type: Sequelize.DECIMAL(20, 6),
    allowNull: true,
  },
  estimationReferenceNo: {
    type: Sequelize.STRING,
    allowNull: true,
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
