'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

class RelatedProject extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    // define association here
  }
}

RelatedProject.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    relatedProjectType: Sequelize.STRING,
    registry: Sequelize.STRING,
    note: Sequelize.STRING,
    owner: Sequelize.STRING,
    projectId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    sequelize,
    modelName: 'RelatedProjects',
  },
);

export { RelatedProject };
