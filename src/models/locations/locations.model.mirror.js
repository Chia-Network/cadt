'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror } from '../database';
import ModelTypes from './locations.modeltypes.cjs';

class ProjectLocationMirror extends Model {}

if (process.env.DB_USE_MIRROR === 'true') {
  ProjectLocationMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'projectLocation',
  });
}

export { ProjectLocationMirror };
