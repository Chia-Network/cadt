'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../database';
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
      foreignKey: 'warehouseProjectId',
    });
    //Qualification.hasMany(Unit);
    // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
    Qualification.belongsToMany(Unit, {
      foreignKey: 'qualificationId',
      through: 'qualification_unit',
      as: 'unit',
    });

    safeMirrorDbHandler(() => {
      QualificationMirror.belongsTo(Project, {
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });

      QualificationMirror.belongsToMany(Unit, {
        through: 'qualification_unit',
        as: 'unit',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => QualificationMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values) {
    safeMirrorDbHandler(() => QualificationMirror.destroy(values));
    return super.destroy(values);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => QualificationMirror.upsert(values, options));
    return super.create(values, options);
  }
}

Qualification.init(ModelTypes, {
  sequelize,
  modelName: 'qualification',
});

export { Qualification };
