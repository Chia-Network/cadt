import { Model } from 'sequelize';

import { sequelizeV2Mirror, safeMirrorDbHandler } from '../../database/v2';
import ModelTypes from './aef-t1-submission-v2.modeltypes.cjs';

class AefT1SubmissionV2Mirror extends Model {}

safeMirrorDbHandler(() => {
  AefT1SubmissionV2Mirror.init(ModelTypes, {
    sequelize: sequelizeV2Mirror,
    modelName: 'aef_t1_submission',
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

export { AefT1SubmissionV2Mirror };
