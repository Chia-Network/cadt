'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects';

class CoBenefit extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    CoBenefit.belongsTo(Project);
  }
}

CoBenefit.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    benefit: Sequelize.STRING,
    owner: Sequelize.STRING,
    projectId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    sequelize,
    modelName: 'CoBenefits',
  },
);

export { CoBenefit };
