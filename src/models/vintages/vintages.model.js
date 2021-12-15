'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project, Unit } from '../projects/index';

import ModelTypes from './projects.modeltypes.cjs';

class Vintage extends Model {
  static associate() {
    Vintage.belongsTo(Project);
    Vintage.hasMany(Unit);
  }
}

Vintage.init(ModelTypes, {
  sequelize,
  modelName: 'vintage',
});

export { Vintage };
