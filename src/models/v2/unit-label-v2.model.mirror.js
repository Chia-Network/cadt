import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './unit-label-v2.modeltypes.cjs';

class UnitLabelV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  UnitLabelV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'unit_label',
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

export { UnitLabelV2Mirror };
