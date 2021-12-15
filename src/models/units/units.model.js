'use strict';
import Sequelize from 'sequelize';
import { sequelize } from '../database';
import { Project, Qualification, Vintage } from '../../models';

import ModelTypes from './projects.modeltypes.cjs';

const { Model } = Sequelize;

class Unit extends Model {
  static associate() {
    Unit.belongsTo(Project);
    Unit.hasMany(Qualification);
    Unit.hasMany(Vintage);
  }
}

Unit.init(ModelTypes, {
  sequelize,
  modelName: 'unit',
});

export { Unit };
