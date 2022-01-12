'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror } from '../database';
import ModelTypes from './ratings.modeltypes.cjs';

class RatingMirror extends Model {}

if (process.env.DB_USE_MIRROR === 'true') {
  RatingMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'projectRating',
  });
}

export { RatingMirror };
