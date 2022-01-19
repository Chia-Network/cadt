'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './units.modeltypes.cjs';

class UnitMirror extends Model {}

safeMirrorDbHandler(() => {
  UnitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'unit',
    foreignKey: 'warehouseUnitId',
  });
});

export { UnitMirror };
