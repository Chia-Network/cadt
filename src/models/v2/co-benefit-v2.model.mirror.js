import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './co-benefit-v2.modeltypes.cjs';

class CoBenefitV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  CoBenefitV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'co_benefit',
    tableName: 'co_benefit',
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

export { CoBenefitV2Mirror };
