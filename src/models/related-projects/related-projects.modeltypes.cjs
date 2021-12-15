const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.NUMBER,
    primaryKey: true,
  },
  relatedProjectType: Sequelize.STRING,
  registry: Sequelize.STRING,
  note: Sequelize.STRING,
  projectId: Sequelize.NUMBER,
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
