'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './qualifications.modeltypes.cjs';

class QualificationMirror extends Model {}

safeMirrorDbHandler(() => {
  QualificationMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'qualification',
    foreignKey: 'qualificationId',
  });
});

export { QualificationMirror };
