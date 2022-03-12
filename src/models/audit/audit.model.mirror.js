'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelizeMirror, safeMirrorDbHandler } from '../../database';
import ModelTypes from './audit.modeltypes.cjs';

class AuditMirror extends Model {}

safeMirrorDbHandler(() => {
  AuditMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'audit',
    freezeTableName: true,
    timestamps: true,
    createdAt: true,
    updatedAt: true,
  });
});

export { AuditMirror };
