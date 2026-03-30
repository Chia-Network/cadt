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
