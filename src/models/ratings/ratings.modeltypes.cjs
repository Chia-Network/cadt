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
  // The orgUid is the singeltonId of the
  // organizations tables on the datalayer
  orgUid: {
    type: Sequelize.STRING,
    required: true,
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
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
