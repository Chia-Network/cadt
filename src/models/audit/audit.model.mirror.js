'use strict';

import { Model } from 'sequelize';

import { sequelizeMirror, initMirrorModel } from '../../database';
import ModelTypes from './audit.modeltypes.js';

class AuditMirror extends Model {}

initMirrorModel(() => {
  AuditMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'audit',
    freezeTableName: true,
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    timezone: '+00:00',
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_general_ci',
    },
    dialectOptions: {
      charset: 'utf8mb4',
      dateStrings: true,
      typeCast: true,
    },
  });
});

export { AuditMirror };
