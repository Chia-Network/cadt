const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.NUMBER,
    primaryKey: true,
  },
  countryRegion: Sequelize.STRING,
  country: Sequelize.STRING,
  owner: Sequelize.STRING,
  projectId: Sequelize.NUMBER,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
