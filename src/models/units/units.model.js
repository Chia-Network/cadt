'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects/index';

class Unit extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    Unit.belongsTo(Project);
  }
}

Unit.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
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
