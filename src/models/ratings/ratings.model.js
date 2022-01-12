'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects/index';

import ModelTypes from './ratings.modeltypes.cjs';
import { RatingMirror } from './ratings.model.mirror';

class Rating extends Model {
  static associate() {
    Rating.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'projectId',
    });

    if (process.env.DB_USE_MIRROR === 'true') {
      RatingMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'projectId',
      });
    }
  }

  static async create(values, options) {
    RatingMirror.create(values, options);
    return super.create(values, options);
  }

  static async destroy(values) {
    RatingMirror.destroy(values);
    return super.destroy(values);
  }
}

Rating.init(ModelTypes, {
  sequelize,
  modelName: 'projectRating',
});

export { Rating };
