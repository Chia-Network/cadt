'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror } from '../database';
import ModelTypes from './vintages.modeltypes.cjs';

class VintageMirror extends Model {}

if (process.env.DB_USE_MIRROR === 'true') {
  VintageMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'vintage',
  });
}

export { VintageMirror };
