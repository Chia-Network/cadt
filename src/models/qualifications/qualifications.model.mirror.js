'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror } from '../database';
import ModelTypes from './qualifications.modeltypes.cjs';

class QualificationMirror extends Model {}

if (process.env.DB_USE_MIRROR === 'true') {
  QualificationMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'qualification',
    foreignKey: 'qualificationId',
  });
}

export { QualificationMirror };
