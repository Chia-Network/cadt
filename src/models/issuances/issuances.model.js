'use strict';
import { Model } from 'sequelize';
import { sequelize, safeMirrorDbHandler, mirrorWrite } from '../../database';
import { Project, Unit } from '..';

import ModelTypes from './issuances.modeltypes.js';
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
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await IssuanceMirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.create(values, options);
  }

  static async destroy(options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await IssuanceMirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    return super.destroy(options);
  }

  static async upsert(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await IssuanceMirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.upsert(values, options);
  }
}

Issuance.init(ModelTypes, {
  sequelize,
  modelName: 'issuance',
  timestamps: true,
});

export { Issuance };
