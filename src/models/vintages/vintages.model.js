'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects/index';

class Vintage extends Model {
  static associate() {
    Vintage.belongsTo(Project);
  }
}

Vintage.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    startDate: Sequelize.DATE,
    endDate: Sequelize.DATE,
    verificationApproach: Sequelize.STRING,
    verificationDate: Sequelize.DATE,
    verificationBody: Sequelize.STRING,
    owner: Sequelize.STRING,
    projectId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
    UnitId: Sequelize.NUMBER,
  },
  {
    sequelize,
    modelName: 'Vintages',
  },
);

export { Vintage };
