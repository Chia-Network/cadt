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
  },
  // The orgUid is the singeltonId of the
  // organizations tables on the datalayer
  orgUid: {
    type: Sequelize.STRING,
    required: true,
  },
  label: {
    type: Sequelize.STRING,
    require: true,
  },
  labelType: {
    type: Sequelize.STRING,
    require: true,
  },
  creditingPeriodStartDate: {
    type: Sequelize.DATE,
    require: true,
  },
  creditingPeriodEndDate: {
    type: Sequelize.DATE,
    require: true,
  },
  validityPeriodStartDate: {
    type: Sequelize.DATE,
    require: true,
  },
  validityPeriodEndDate: {
    type: Sequelize.DATE,
    require: true,
  },
  unitQuantity: {
    type: Sequelize.INTEGER,
    require: true,
  },
  labelLink: {
    type: Sequelize.STRING,
    require: true,
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
