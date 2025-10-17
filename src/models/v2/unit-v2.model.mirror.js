import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './unit-v2.modeltypes.cjs';

class UnitV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  UnitV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'unit',
  tableName: 'unit',
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

export { UnitV2Mirror };
