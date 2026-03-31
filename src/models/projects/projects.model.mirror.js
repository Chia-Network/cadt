'use strict';

import { Model } from 'sequelize';

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './projects.modeltypes.js';

class ProjectMirror extends Model {}

safeMirrorDbHandler(() => {
  ProjectMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'project',
    foreignKey: 'warehouseProjectId',
    timestamps: true,
    timezone: '+00:00',
    useHooks: true,
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

export { ProjectMirror };
