const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  org_uid: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
  },
  registry_id: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
  },
  root_hash: {
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
  onchain_confirmation_time_stamp: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false,
  },
  author: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  comment: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  generation: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  created_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updated_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
