'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects';
import { Unit } from '../units';

import ModelTypes from './projects.modeltypes.cjs';

class Qualification extends Model {
  static associate() {
    Qualification.belongsTo(Project);
    Qualification.hasMany(Unit);
  }
}

Qualification.init(ModelTypes, {
  sequelize,
  modelName: 'qualification',
  foreignKey: 'qualificationId',
});

export { Qualification };
