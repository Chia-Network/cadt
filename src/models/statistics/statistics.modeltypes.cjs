const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  uri: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false
  },
  statisticsJsonString: {
    type: Sequelize.STRING,
    required: true,
    allowNull: false
  },
  timestamp :{
    type: Sequelize.STRING,
    required: true,
    allowNull: false
  }
};
