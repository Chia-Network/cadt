const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  org_uid: {
    type: Sequelize.STRING,
    unique: true,
  },
  org_hash: Sequelize.STRING,
  name: Sequelize.STRING,
  icon: Sequelize.STRING,
  registry_id: Sequelize.STRING,
  registry_hash: Sequelize.STRING,
  subscribed: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  synced: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  file_store_subscribed: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  sync_remaining: {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  balance: Sequelize.STRING,
  pending_balance: Sequelize.STRING,
  is_home: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  metadata: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: '{}',
  },
  data_model_version_store_id: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  data_model_version_store_hash: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  created_at: Sequelize.DATE,
  updated_at: Sequelize.DATE,
};
