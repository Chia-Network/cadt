import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './aef-t3-actions-v2.modeltypes.cjs';

class AefT3ActionsV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  AefT3ActionsV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'aef_t3_actions',
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

export { AefT3ActionsV2Mirror };
