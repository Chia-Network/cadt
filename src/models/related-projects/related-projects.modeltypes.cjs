const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.NUMBER,
    primaryKey: true,
  },
  relatedProjectType: Sequelize.STRING,
  registry: Sequelize.STRING,
  note: Sequelize.STRING,
  projectId: {
    type: Sequelize.NUMBER,
    onDelete: 'CASCADE',
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
