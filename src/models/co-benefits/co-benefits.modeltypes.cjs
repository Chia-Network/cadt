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
  // Cobenefits are not required. Not sure how that affects the 'id' field above, but users may not have any cobenefits to add. It should be optional.
  cobenefit: {
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
  },
};
