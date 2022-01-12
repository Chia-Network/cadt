'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror } from '../database';
import ModelTypes from './co-benifets.modeltypes.cjs';

class CoBenefitMirror extends Model {}

if (process.env.DB_USE_MIRROR === 'true') {
  CoBenefitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'coBenefit',
  });
}

export { CoBenefitMirror };
