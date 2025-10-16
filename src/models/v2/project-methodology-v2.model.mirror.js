import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './project-methodology-v2.modeltypes.cjs';

class ProjectMethodologyV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  ProjectMethodologyV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'project_methodology',
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

export { ProjectMethodologyV2Mirror };
