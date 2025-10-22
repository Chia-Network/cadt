const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  uuid: {
    type: Sequelize.STRING,
    unique: true,
  },
  table: Sequelize.STRING,
  action: Sequelize.STRING,
  data: Sequelize.TEXT,
  commited: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  failedCommit: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'failed_commit',
  },
  isTransfer: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_transfer',
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
    field: 'updated_at',
  },
};

