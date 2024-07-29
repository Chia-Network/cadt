'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database/index.js';
import ModelTypes from './locations.modeltypes.cjs';

class ProjectLocationMirror extends Model {}

safeMirrorDbHandler(() => {
  ProjectLocationMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'projectLocation',
    timestamps: true,
    timezone: '+00:00',
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

export { ProjectLocationMirror };
