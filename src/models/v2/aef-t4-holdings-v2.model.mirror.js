import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './aef-t4-holdings-v2.modeltypes.cjs';

class AefT4HoldingsV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  AefT4HoldingsV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'aef_t4_holdings',
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

export { AefT4HoldingsV2Mirror };
