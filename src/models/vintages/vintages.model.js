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
      targetKey: 'warehouseProjectId',
      foreignKey: 'projectId',
    });
    Vintage.belongsTo(Unit, {
      targetKey: 'warehouseUnitId',
      foreignKey: 'unitId',
    });

    safeMirrorDbHandler(() => {
      VintageMirror.belongsTo(Project, {
        targetKey: 'warehouseProjectId',
        foreignKey: 'projectId',
      });
      VintageMirror.belongsTo(Unit, {
        targetKey: 'warehouseUnitId',
        foreignKey: 'unitId',
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
