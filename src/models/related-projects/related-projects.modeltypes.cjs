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
    required: true,
    onDelete: 'CASCADE',
  },
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  // Need to add field 'relatedProjectID' with type STRING and make it optional.
  // This is because a related project may not be in the warehouse, so we can't rely on warehouseProjectId field.
  // This would be the field a user would use to find the related project within the registry listed below.
  relationshipType: Sequelize.STRING,
  registry: Sequelize.STRING,
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  updatedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
};
