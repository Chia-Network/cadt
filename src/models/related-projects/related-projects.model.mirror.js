'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './related-projects.modeltypes.cjs';

class RelatedProjectMirror extends Model {}

safeMirrorDbHandler(() => {
  RelatedProjectMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'relatedProject',
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

export { RelatedProjectMirror };
