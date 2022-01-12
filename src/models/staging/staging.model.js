'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;

import rxjs from 'rxjs';
import { sequelize } from '../database';

import ModelTypes from './staging.modeltypes.cjs';

class Staging extends Model {
  static changes = new rxjs.Subject();

  static async create(values, options) {
    Staging.changes.next(['staging']);
    return super.create(values, options);
  }

  static async destroy(values) {
    Staging.changes.next(['staging']);
    return super.destroy(values);
  }
}

Staging.init(ModelTypes, {
  sequelize,
  modelName: 'staging',
  freezeTableName: true,
});

export { Staging };
