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
  data: Sequelize.STRING,
  commited: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  failed_commit: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  is_transfer: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  created_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updated_at: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
};
