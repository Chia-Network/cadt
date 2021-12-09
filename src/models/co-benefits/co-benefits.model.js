'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects';

class CoBenefit extends Model {
  static associate() {
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
