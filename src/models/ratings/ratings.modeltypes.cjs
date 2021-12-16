const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  type: Sequelize.STRING,
  rating: Sequelize.NUMBER,
  link: Sequelize.STRING,
  scale: Sequelize.STRING,
  projectId: {
    type: Sequelize.INTEGER,
    onDelete: 'CASCADE',
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
