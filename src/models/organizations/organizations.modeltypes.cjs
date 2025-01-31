const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orgUid: {
    type: Sequelize.STRING,
    unique: true,
  },
  orgHash: Sequelize.STRING,
  name: Sequelize.STRING,
  icon: Sequelize.STRING,
  registryId: Sequelize.STRING,
  registryHash: Sequelize.STRING,
  fileStoreId: Sequelize.STRING,
  fileStoreSubscribed: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  subscribed: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  isHome: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  metadata: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: '{}',
  },
  prefix: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '0',
  },
  synced: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  sync_remaining: {
    type: Sequelize.INTEGER,
    defaultValue: 0,
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
  dataModelVersionStoreId: {
    type: Sequelize.STRING,
  },
  dataModelVersionStoreHash: {
    type: Sequelize.STRING,
  },
};
