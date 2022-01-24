'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './qualificationUnits.modeltypes.cjs';

class QualificationUnitMirror extends Model {}

safeMirrorDbHandler(() => {
  QualificationUnitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'qualification_unit',
    freezeTableName: true,
  });
});

export { QualificationUnitMirror };
