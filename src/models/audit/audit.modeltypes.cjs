const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orgUid: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
  },
  registryId: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
  },
  rootHash: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
  },
  type: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
  },
  change: {
    type: Sequelize.TEXT,
    required: true,
    allowNull: true,
  },
  table: {
    type: Sequelize.STRING,
    required: true,
    allowNull: true,
  },
  onchainConfirmationTimeStamp: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
  },
  author: {
    type: Sequelize.STRING,
  },
  comment: {
    type: Sequelize.STRING,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  generation: {
    type: Sequelize.INTEGER,
  }
};
