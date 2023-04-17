'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './co-benefits.modeltypes.cjs';

class CoBenefitMirror extends Model {}

safeMirrorDbHandler(() => {
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
