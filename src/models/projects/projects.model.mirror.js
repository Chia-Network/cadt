'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './projects.modeltypes.cjs';

class ProjectMirror extends Model {}

safeMirrorDbHandler(() => {
  ProjectMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'project',
    foreignKey: 'warehouseProjectId',
    timestamps: true,
  });
});

export { ProjectMirror };
