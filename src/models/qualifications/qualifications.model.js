'use strict';
import Sequelize from 'sequelize';
const { DataTypes, Model } = Sequelize;
import { sequelize } from '../database';

class Qualification extends Model { }

Qualification.init({
  id: {
    allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
  },
  qualificationLink: {
    type: Sequelize.STRING
  },
  projectId: {
    type: Sequelize.NUMBER
  },
  type: {
    type: Sequelize.STRING
  },
  label: {
    type: Sequelize.STRING
  },
  creditingPeriodStartDate: {
    type: Sequelize.DATE
  },
  creditingPeriodEndDate: {
    type: Sequelize.DATE
  },
  owner: {
    type: Sequelize.STRING
  },
  unitId: {
    type: Sequelize.NUMBER
  },
  createdAt: {
    allowNull: false,
      type: Sequelize.DATE
  },
  updatedAt: {
    allowNull: false,
      type: Sequelize.DATE
  }
}, { sequelize, modelName: 'qualification' });

export { Qualification };
