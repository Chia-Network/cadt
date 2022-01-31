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
    type: Sequelize.INTEGER,
    onDelete: 'CASCADE',
    required: true,
  },
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  creditingPeriodStart: {
    type: Sequelize.DATE,
    required: true,
  },
  creditingPeriodEnd: {
    type: Sequelize.DATE,
    required: true,
  },
  unitCount: {
    type: Sequelize.INTEGER,
    required: true,
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
