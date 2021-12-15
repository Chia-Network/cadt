const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.NUMBER,
    primaryKey: true,
  },
  benefit: Sequelize.STRING,
  owner: Sequelize.STRING,
  projectId: {
    type: Sequelize.NUMBER,
    onDelete: 'CASCADE',
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
