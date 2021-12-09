'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

class Staging extends Model {
  static associate() {
    // define association here
  }
}

Staging.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    uuid: Sequelize.STRING,
    table: Sequelize.STRING,
    action: Sequelize.STRING,
    data: Sequelize.STRING,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    sequelize,
    modelName: 'Staging',
  },
);

export { Staging };
