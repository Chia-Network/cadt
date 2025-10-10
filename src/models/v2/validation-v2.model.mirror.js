import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './validation-v2.modeltypes.cjs';

class ValidationV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  ValidationV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'validation',
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

export { ValidationV2Mirror };
