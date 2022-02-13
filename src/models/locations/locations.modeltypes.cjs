const { uuid: uuidv4 } = require('uuidv4');
const Sequelize = require('sequelize');

module.exports = {
  id: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
    defaultValue: () => uuidv4(),
    primaryKey: true,
  },
  warehouseProjectId: {
    type: Sequelize.STRING,
    required: true,
    onDelete: 'CASCADE',
  },
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  country: {
    type: Sequelize.STRING,
    required: true,
  },
  inCountryRegion: {
    type: Sequelize.STRING,
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
