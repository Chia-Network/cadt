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
    type: Sequelize.STRING,
    required: true,
    allowNull: true,
  },
  table: {
    type: Sequelize.STRING,
    required: true,
    allowNull: true,
  },
  onchainConfirmationTimeStamp: {
    type: 'TIMESTAMP',
    required: true,
    allowNull: false,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
