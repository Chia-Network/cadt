'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

class Qualification extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    // define association here
  }
}

Qualification.init(
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    qualificationLink: {
      type: Sequelize.STRING,
    },
    projectId: {
      type: Sequelize.NUMBER,
    },
    type: {
      type: Sequelize.STRING,
    },
    label: {
      type: Sequelize.STRING,
    },
    creditingPeriodStartDate: {
      type: Sequelize.DATE,
    },
    creditingPeriodEndDate: {
      type: Sequelize.DATE,
    },
    owner: {
      type: Sequelize.STRING,
    },
    unitId: {
      type: Sequelize.NUMBER,
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  },
  { sequelize, modelName: 'Qualifications' },
);

export { Qualification };
