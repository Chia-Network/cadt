'use strict';
import Sequelize from 'sequelize';
import { sequelize } from '../database';
import { Project, Qualification, Vintage } from '../../models';

import ModelTypes from './units.modeltypes.cjs';

const { Model } = Sequelize;

class Unit extends Model {
  static associate() {
    Unit.hasOne(Vintage);

    // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
    Unit.belongsToMany(Unit, {
      through: 'qualification_unit',
    });
  }
}

Unit.init(ModelTypes, {
  sequelize,
  modelName: 'unit',
  foreignKey: 'unitId',
});

export { Unit };
