'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './vintages.modeltypes.cjs';

class VintageMirror extends Model {}

safeMirrorDbHandler(() => {
  VintageMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'vintage',
  });
});

export { VintageMirror };
