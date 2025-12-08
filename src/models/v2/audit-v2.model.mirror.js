'use strict';

import { Sequelize, Model } from 'sequelize';

import { sequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './audit-v2.modeltypes.cjs';

class AuditV2Mirror extends Model {
  // V2-specific audit mirror methods will be added here as needed
}

AuditV2Mirror.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'AuditV2Mirror',
  tableName: 'audit',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default AuditV2Mirror;
