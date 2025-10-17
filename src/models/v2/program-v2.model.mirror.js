import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './program-v2.modeltypes.cjs';

class ProgramV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  ProgramV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'program',
  tableName: 'program',
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

export { ProgramV2Mirror };
