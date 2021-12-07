'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

class Vintage extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    // define association here
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
  },
  {
    sequelize,
    modelName: 'Vintages',
  },
);

export { Vintage };
