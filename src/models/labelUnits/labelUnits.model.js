'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database';

import ModelTypes from './labelUnits.modeltypes.cjs';
import { LabelUnitMirror } from './labelUnits.model.mirror';

class LabelUnit extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(() => LabelUnitMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values, options) {
    safeMirrorDbHandler(() => LabelUnitMirror.destroy(values, options));
    return super.destroy(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => LabelUnitMirror.upsert(values, options));
    return super.upsert(values, options);
  }
}

LabelUnit.init(ModelTypes, {
  sequelize,
  modelName: 'label_unit',
  freezeTableName: true,
  timestamps: true,
});

export { LabelUnit };
