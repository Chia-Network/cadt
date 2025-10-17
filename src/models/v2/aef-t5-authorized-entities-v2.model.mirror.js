import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './aef-t5-authorized-entities-v2.modeltypes.cjs';

class AefT5AuthorizedEntitiesV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  AefT5AuthorizedEntitiesV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'aef_t5_authorized_entities',
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

export { AefT5AuthorizedEntitiesV2Mirror };
