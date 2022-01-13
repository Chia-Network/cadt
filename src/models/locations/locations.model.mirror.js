'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './locations.modeltypes.cjs';

class ProjectLocationMirror extends Model {}

safeMirrorDbHandler(() => {
  ProjectLocationMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'projectLocation',
  });
});

export { ProjectLocationMirror };
