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
  ratingType: {
    type: Sequelize.STRING,
    required: true,
  },
  ratingRangeHighest: {
    type: Sequelize.INTEGER,
    required: true,
  },
  ratingRangeLowest: {
    type: Sequelize.INTEGER,
    requred: true,
  },
  rating: {
    type: Sequelize.INTEGER,
    requred: true,
  },
  ratingLink: Sequelize.STRING,
  // 'ratingLink' is a required field.
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
