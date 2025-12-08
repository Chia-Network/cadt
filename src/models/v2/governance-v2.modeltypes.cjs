const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  meta_key: {
    type: Sequelize.STRING,
    unique: true,
    required: true,
  },
  meta_value: {
    type: Sequelize.STRING,
    required: true,
  },
  confirmed: {
    type: Sequelize.BOOLEAN,
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
