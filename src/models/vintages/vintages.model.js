'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project, Unit } from '../../models';

import ModelTypes from './vintages.modeltypes.cjs';

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
  }
}

Vintage.init(ModelTypes, {
  sequelize,
  modelName: 'vintage',
});

export { Vintage };
