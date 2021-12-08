'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects/index';

class Rating extends Model {
  /**
   * Helper method for defining associations.
   * This method is not a part of Sequelize lifecycle.
   * The `models/index` file will call this method automatically.
   */
  static associate(models) {
    Rating.belongsTo(Project);
  }
}

Rating.init(
  {
    id: {
      type: Sequelize.NUMBER,
      primaryKey: true,
    },
    ratingType: Sequelize.STRING,
    rating: Sequelize.NUMBER,
    link: Sequelize.STRING,
    scale: Sequelize.STRING,
    owner: Sequelize.STRING,
    projectId: Sequelize.NUMBER,
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE,
  },
  {
    sequelize,
    modelName: 'ProjectRatings',
  },
);

export { Rating };
