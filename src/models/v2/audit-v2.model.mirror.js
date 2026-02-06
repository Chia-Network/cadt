'use strict';

import { Model } from 'sequelize';
import { sequelizeV2Mirror, safeMirrorDbHandlerV2 } from '../../database/v2/index.js';
import ModelTypes from './audit-v2.modeltypes.cjs';

class AuditV2Mirror extends Model {}

safeMirrorDbHandlerV2(() => {
  AuditV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'AuditV2Mirror',
    tableName: 'audit',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
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

export default AuditV2Mirror;
