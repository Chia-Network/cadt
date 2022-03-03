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
    type: Sequelize.STRING,
    required: true,
  },
  ratingRangeLowest: {
    type: Sequelize.STRING,
    requred: true,
  },
  rating: {
    type: Sequelize.STRING,
    requred: true,
  },
  ratingLink: Sequelize.STRING,
  timeStaged: {
    type: 'TIMESTAMP',
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
