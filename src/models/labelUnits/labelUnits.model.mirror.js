'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './labelUnits.modeltypes.cjs';

class LabelUnitMirror extends Model {}

safeMirrorDbHandler(() => {
  LabelUnitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'label_unit',
    freezeTableName: true,
    timestamps: true,
  });
});

export { LabelUnitMirror };
