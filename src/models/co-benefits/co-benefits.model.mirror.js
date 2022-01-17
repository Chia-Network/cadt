'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './co-benifets.modeltypes.cjs';

class CoBenefitMirror extends Model {}

safeMirrorDbHandler(() => {
  CoBenefitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'coBenefit',
  });
});

export { CoBenefitMirror };
