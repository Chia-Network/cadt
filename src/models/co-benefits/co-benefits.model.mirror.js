'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './co-benefits.modeltypes.cjs';

class CoBenefitMirror extends Model {}

safeMirrorDbHandler(() => {
  CoBenefitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'coBenefit',
    timestamps: true,
  });
});

export { CoBenefitMirror };
