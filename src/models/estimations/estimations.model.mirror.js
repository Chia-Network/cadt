'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './estimations.modeltypes.cjs';

class EstimationMirror extends Model {}

safeMirrorDbHandler(() => {
  EstimationMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'estimation',
    timestamps: true,
  });
});

export { EstimationMirror };
