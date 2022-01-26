'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../database';
import ModelTypes from './labels.modeltypes.cjs';

class LabelMirror extends Model {}

safeMirrorDbHandler(() => {
  LabelMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'label',
    foreignKey: 'labelId',
    timestamps: true,
  });
});

export { LabelMirror };
