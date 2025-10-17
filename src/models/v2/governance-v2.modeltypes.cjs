const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  metaKey: {
    type: Sequelize.STRING,
    unique: true,
    required: true,
    allowNull: false,
  },
  metaValue: {
    type: Sequelize.TEXT,
    required: true,
    allowNull: false,
  },
  confirmed: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
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



