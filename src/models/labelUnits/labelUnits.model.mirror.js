'use strict';

import { Model } from 'sequelize';

import { sequelizeMirror, initMirrorModel } from '../../database';
import ModelTypes from './labelUnits.modeltypes.js';

class LabelUnitMirror extends Model {}

initMirrorModel(() => {
  LabelUnitMirror.init(ModelTypes, {
    sequelize: sequelizeMirror,
    modelName: 'label_unit',
    freezeTableName: true,
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

export { LabelUnitMirror };
