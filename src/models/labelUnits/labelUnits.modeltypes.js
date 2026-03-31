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
