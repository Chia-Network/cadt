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
  committed: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'committed', // Explicit field mapping to ensure correct column name
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
