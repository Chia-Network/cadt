'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror } from '../database';
import ModelTypes from './projects.modeltypes.cjs';

class ProjectMirror extends Model {}

if (process.env.DB_USE_MIRROR === 'true') {
  ProjectMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'project',
    foreignKey: 'projectId',
  });
}

export { ProjectMirror };
