'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../database';

import ModelTypes from './qualificationUnits.modeltypes.cjs';
import { QualificationUnitMirror } from './qualificationUnits.model.mirror';

class QualificationUnit extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(() => QualificationUnitMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values) {
    safeMirrorDbHandler(() => QualificationUnitMirror.destroy(values));
    return super.destroy(values);
  }
}

QualificationUnit.init(ModelTypes, {
  sequelize,
  modelName: 'qualification_unit',
  freezeTableName: true,
});

export { QualificationUnit };
