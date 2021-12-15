'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects';
import { Unit } from '../units';

class Qualification extends Model {
  static associate() {
    Qualification.belongsTo(Project);
    Qualification.hasMany(Unit);
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
    qualificationId: {
      type: Sequelize.NUMBER,
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
  { sequelize, modelName: 'Qualifications', foreignKey: 'qualificationId' },
);

export { Qualification };
