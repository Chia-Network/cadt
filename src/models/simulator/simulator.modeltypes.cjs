const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  key: {
    type: Sequelize.STRING,
    unique: true,
  },
  value: Sequelize.STRING,
};
