'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects/index';

import ModelTypes from './ratings.modeltypes.cjs';

class Rating extends Model {
  static associate() {
    Rating.belongsTo(Project, {
      onDelete: 'CASCADE',
      foreignKey: {
        allowNull: false,
      },
    });
  }
}

Rating.init(ModelTypes, {
  sequelize,
  modelName: 'projectRating',
});

export { Rating };
