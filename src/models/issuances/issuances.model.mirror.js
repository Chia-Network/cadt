'use strict';

import { Model } from 'sequelize';

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './issuances.modeltypes.js';

class IssuanceMirror extends Model {}

safeMirrorDbHandler(() => {
  IssuanceMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'issuance',
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

export { IssuanceMirror };
