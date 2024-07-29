'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database/index.js';
import ModelTypes from './ratings.modeltypes.cjs';

class RatingMirror extends Model {}

safeMirrorDbHandler(() => {
  RatingMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'projectRating',
    timestamps: true,
    timezone: '+00:00',
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci',
    },
    dialectOptions: {
      charset: 'utf8mb4',
      dateStrings: true,
      typeCast: true,
    },
  });
});

export { RatingMirror };
