'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project, Unit } from '../../models';

import ModelTypes from './vintages.modeltypes.cjs';

class Vintage extends Model {
  static associate() {
    Vintage.belongsTo(Project);
    Vintage.belongsToMany(Unit, {
      through: 'vintage_unit',
      as: 'vintage',
    });
  }
}

Vintage.init(ModelTypes, {
  sequelize,
  modelName: 'vintage',
});

export { Vintage };
