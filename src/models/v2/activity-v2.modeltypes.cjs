const Sequelize = require('sequelize');

module.exports = {
  cadTrustActivityId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  activityProgramName: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  activityRegistry: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  activityRegistryActivityId: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  activityRegistryProgramId: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  activityDescription: {
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
