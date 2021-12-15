const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.NUMBER,
    primaryKey: true,
  },
  uuid: Sequelize.STRING,
  table: Sequelize.STRING,
  action: Sequelize.STRING,
  data: Sequelize.STRING,
  commited: Sequelize.BOOLEAN,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
