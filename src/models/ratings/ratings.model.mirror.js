'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './ratings.modeltypes.cjs';

class RatingMirror extends Model {}

safeMirrorDbHandler(() => {
  RatingMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'projectRating',
    timestamps: true,
  });
});

export { RatingMirror };
