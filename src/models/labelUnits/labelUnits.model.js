'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../database';

import ModelTypes from './labelUnits.modeltypes.cjs';
import { LabelUnitMirror } from './labelUnits.model.mirror';

class LabelUnit extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(() => LabelUnitMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values) {
    safeMirrorDbHandler(() => LabelUnitMirror.destroy(values));
    return super.destroy(values);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => LabelUnitMirror.upsert(values, options));
    return super.create(values, options);
  }
}

LabelUnit.init(ModelTypes, {
  sequelize,
  modelName: 'label_unit',
  freezeTableName: true,
});

export { LabelUnit };
