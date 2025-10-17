import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './activity-v2.modeltypes.cjs';

class ActivityV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  ActivityV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'activity',
  tableName: 'activity',
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

export { ActivityV2Mirror };
