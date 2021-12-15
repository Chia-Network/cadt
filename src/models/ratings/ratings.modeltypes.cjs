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
  projectId: {
    type: Sequelize.NUMBER,
    onDelete: 'CASCADE',
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
