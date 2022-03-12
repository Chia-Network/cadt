'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './issuances.modeltypes.cjs';

class IssuanceMirror extends Model {}

safeMirrorDbHandler(() => {
  IssuanceMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'issuance',
    timestamps: true,
  });
});

export { IssuanceMirror };
