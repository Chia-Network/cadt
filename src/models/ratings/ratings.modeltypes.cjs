const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.NUMBER,
    primaryKey: true,
  },
  ratingType: Sequelize.STRING,
  rating: Sequelize.NUMBER,
  link: Sequelize.STRING,
  scale: Sequelize.STRING,
  projectId: Sequelize.NUMBER,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
