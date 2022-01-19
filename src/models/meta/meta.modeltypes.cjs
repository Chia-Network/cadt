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
  },
  meta_value: Sequelize.STRING,
};
