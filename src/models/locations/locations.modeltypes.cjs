const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.STRING,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  countryRegion: Sequelize.STRING,
  country: Sequelize.STRING,
  projectId: {
    type: Sequelize.INTEGER,
    onDelete: 'CASCADE',
  },
  createdAt: Sequelize.DATE,
  updatedAt: Sequelize.DATE,
};
