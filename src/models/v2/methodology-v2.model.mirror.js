'use strict';

import { Model } from 'sequelize';
import { sequelizeV2Mirror as getSequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2/index.js';
import ModelTypes from './methodology-v2.modeltypes.cjs';

class MethodologyV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  MethodologyV2Mirror.init(ModelTypes, {
    sequelize: getSequelizeV2Mirror(),
    modelName: 'methodology',
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

export { MethodologyV2Mirror };
