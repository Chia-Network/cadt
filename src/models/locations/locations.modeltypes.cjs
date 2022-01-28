const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.STRING,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  warehouseProjectId: {
    type: Sequelize.INTEGER,
    required: true,
    onDelete: 'CASCADE',
  },
  country: {
    type: Sequelize.STRING,
    required: true,
  },
  // Need to make 'inCountryRegion' field optional. Some countries may have use regions while others do not and that is ok.
  inCountryRegion: {
    type: Sequelize.STRING,
    required: true,
  },
  geographicIdentifier: {
    type: Sequelize.STRING,
    required: true,
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    allowNull: false,
  },
};
