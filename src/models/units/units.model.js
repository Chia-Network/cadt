'use strict';
import Sequelize from 'sequelize';
import { sequelize } from '../database';
import { Qualification, Vintage } from '../../models';

import ModelTypes from './units.modeltypes.cjs';
import rxjs from 'rxjs';

const { Model } = Sequelize;

class Unit extends Model {
  static changes = new rxjs.Subject();

  static associate() {
    Unit.hasOne(Vintage);

    // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
    Unit.belongsToMany(Qualification, {
      through: 'qualification_unit',
      as: 'qualifications',
    });
  }

  static async create(values, options) {
    const createResult = await super.create(values, options);
    const { orgUid } = createResult;

    Unit.changes.next(['units', orgUid]);

    return createResult;
  }

  static async destroy(values) {
    const record = await super.findOne(values.where);
    const { orgUid } = record.dataValues;

    Unit.changes.next(['units', orgUid]);

    console.log(values);

    return super.destroy(values);
  }
}

Unit.init(ModelTypes, {
  sequelize,
  modelName: 'unit',
  foreignKey: 'unitId',
});

export { Unit };
