'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror } from '../database';
import ModelTypes from './units.modeltypes.cjs';

class UnitMirror extends Model {}

if (process.env.DB_USE_MIRROR === 'true') {
  UnitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'unit',
    foreignKey: 'unitId',
  });
}

export { UnitMirror };
