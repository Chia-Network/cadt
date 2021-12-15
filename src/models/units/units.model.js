'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project, Qualification, Vintage } from '../../models';

class Unit extends Model {
  static associate() {
    Unit.belongsTo(Project);
    Unit.hasMany(Qualification);
    Unit.hasMany(Vintage);
  }
}

Unit.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    ProjectId: Sequelize.STRING,
    owner: Sequelize.STRING,
    buyer: Sequelize.STRING,
    registry: Sequelize.STRING,
    blockIdentifier: Sequelize.STRING,
    identifier: Sequelize.STRING,
    qualificationId: Sequelize.NUMBER,
    unitType: Sequelize.STRING,
    unitCount: Sequelize.NUMBER,
    unitStatus: Sequelize.STRING,
    unitStatusDate: Sequelize.DATE,
    transactionType: Sequelize.STRING,
    unitIssuanceLocation: Sequelize.STRING,
    unitLink: Sequelize.STRING,
    correspondingAdjustment: Sequelize.STRING,
    unitTag: Sequelize.STRING,
    vintageId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    sequelize,
    modelName: 'Units',
  },
);

export { Unit };
