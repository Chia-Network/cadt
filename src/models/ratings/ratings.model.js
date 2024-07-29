'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database/index.js';
import { Project } from '../projects/index.js';

import ModelTypes from './ratings.modeltypes.cjs';
import { RatingMirror } from './ratings.model.mirror.js';

class Rating extends Model {
  static associate() {
    Rating.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    safeMirrorDbHandler(() => {
      RatingMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await RatingMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await RatingMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await RatingMirror.upsert(values, mirrorOptions);
    });
    return super.upsert(values, options);
  }
}

Rating.init(ModelTypes, {
  sequelize,
  modelName: 'projectRating',
  timestamps: true,
});

export { Rating };
