'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects/index';

import ModelTypes from './projects.modeltypes.cjs';

class Vintage extends Model {
  static associate() {
    Vintage.belongsTo(Project);
  }
}

Vintage.init(ModelTypes, {
  sequelize,
  modelName: 'vintages',
});

export { Vintage };
