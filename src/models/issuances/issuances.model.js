'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../database';
import { Project, Unit } from '..';

import ModelTypes from './issuances.modeltypes.cjs';
import { IssuanceMirror } from './issuances.model.mirror';

class Issuance extends Model {
  static associate() {
    Issuance.belongsTo(Project, {
      sourceKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    Issuance.hasMany(Unit, {
      targetKey: 'issuanceId',
      foreignKey: 'issuanceId',
    });

    safeMirrorDbHandler(() => {
      IssuanceMirror.belongsTo(Project, {
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
      IssuanceMirror.hasOne(Unit, {
        targetKey: 'warehouseUnitId',
        foreignKey: 'warehouseUnitId',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => IssuanceMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values, options) {
    safeMirrorDbHandler(() => IssuanceMirror.destroy(values, options));
    return super.destroy(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => IssuanceMirror.upsert(values, options));
    return super.upsert(values, options);
  }
}

Issuance.init(ModelTypes, {
  sequelize,
  modelName: 'issuance',
  timestamps: true,
});

export { Issuance };
