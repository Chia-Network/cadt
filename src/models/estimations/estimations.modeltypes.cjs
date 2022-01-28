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
    onDelete: 'CASCADE',
    required: true,
  },
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  creditingPeriodStart: {
    type: Sequelize.STRING,
    required: true,
  },
  creditingPeriodEnd: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
    // Need to add required to this field. Any estimatations will require an end date. It is fine to default to NOW, but should still be required.
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
