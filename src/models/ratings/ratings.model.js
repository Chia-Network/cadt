'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects/index';

class Rating extends Model {
  static associate() {
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
