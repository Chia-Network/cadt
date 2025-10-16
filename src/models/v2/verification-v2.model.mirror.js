'use strict';

import { Model } from 'sequelize';
import { sequelizeV2Mirror as getSequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2/index.js';
import ModelTypes from './verification-v2.modeltypes.cjs';

class VerificationV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  VerificationV2Mirror.init(ModelTypes, {
    sequelize: getSequelizeV2Mirror(),
    modelName: 'verification',
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

export { VerificationV2Mirror };
