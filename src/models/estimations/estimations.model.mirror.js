'use strict';

import { Model } from 'sequelize';

import { sequelizeMirror, initMirrorModel } from '../../database';
import ModelTypes from './estimations.modeltypes.js';

class EstimationMirror extends Model {}

initMirrorModel(() => {
  EstimationMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'estimation',
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

export { EstimationMirror };
