'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects';
import { Unit } from '../units';

import ModelTypes from './qualifications.modeltypes.cjs';
import { QualificationMirror } from './qualifications.model.mirror';

class Qualification extends Model {
  static associate() {
    // When all qualifications are removed from
    // all projects and units, remove completly,
    // otherwise just dissaciate
    Qualification.belongsTo(Project, {
      targetKey: 'warehouseProjectId',
      foreignKey: 'projectId',
    });
    //Qualification.hasMany(Unit);
    // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
    Qualification.belongsToMany(Unit, {
      through: 'qualification_unit',
      as: 'unit',
    });
  }

  static async create(values, options) {
    QualificationMirror.create(values, options);
    return super.create(values, options);
  }

  static async destroy(values) {
    QualificationMirror.destroy(values);
    return super.destroy(values);
  }
}

Qualification.init(ModelTypes, {
  sequelize,
  modelName: 'qualification',
  foreignKey: 'qualificationId',
});

export { Qualification };
