'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../database';
import { Project, Unit } from '../../models';

import ModelTypes from './vintages.modeltypes.cjs';
import { VintageMirror } from './vintages.model.mirror';

class Vintage extends Model {
  static associate() {
    Vintage.belongsTo(Project, {
      sourceKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    Vintage.hasMany(Unit, {
      targetKey: 'vintageId',
      foreignKey: 'vintageId',
    });

    safeMirrorDbHandler(() => {
      VintageMirror.belongsTo(Project, {
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
      VintageMirror.hasOne(Unit, {
        targetKey: 'warehouseUnitId',
        foreignKey: 'warehouseUnitId',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => VintageMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values) {
    safeMirrorDbHandler(() => VintageMirror.destroy(values));
    return super.destroy(values);
  }
}

Vintage.init(ModelTypes, {
  sequelize,
  modelName: 'vintage',
});

export { Vintage };
