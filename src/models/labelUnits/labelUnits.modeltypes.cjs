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
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  warehouseUnitId: {
    type: Sequelize.STRING,
    required: true,
  },
  labelId: {
    type: Sequelize.STRING,
    required: true,
  },
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
