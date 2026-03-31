import { v4 as uuidv4 } from 'uuid';
import Sequelize from 'sequelize';
export default {
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
  relatedProjectId: {
    type: Sequelize.STRING,
  },
  relationshipType: Sequelize.STRING,
  registry: Sequelize.STRING,
  timeStaged: {
    type: Sequelize.STRING,
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
