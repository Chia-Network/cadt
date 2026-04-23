'use strict';

import { Model } from 'sequelize';

import { sequelizeMirror, initMirrorModel } from '../../database';
import ModelTypes from './co-benefits.modeltypes.js';

class CoBenefitMirror extends Model {}

initMirrorModel(() => {
  CoBenefitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'coBenefit',
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

export { CoBenefitMirror };
