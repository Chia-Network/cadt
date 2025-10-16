'use strict';

import { Model } from 'sequelize';
import { sequelizeV2Mirror as getSequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2/index.js';
import ModelTypes from './audit-v2.modeltypes.cjs';

class AuditV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  AuditV2Mirror.init(ModelTypes, {
    sequelize: getSequelizeV2Mirror(),
    modelName: 'audit',
    timestamps: true,
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

export { AuditV2Mirror };
