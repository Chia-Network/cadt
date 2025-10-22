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
    allowNull: false,
    field: 'meta_key',
  },
  metaValue: {
    type: Sequelize.TEXT,
    allowNull: true,
    field: 'meta_value',
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    field: 'updated_at',
  },
};



