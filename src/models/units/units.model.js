'use strict';

import Sequelize from 'sequelize';
import { sequelize } from '../database';
import { Qualification, Vintage } from '../../models';
import { UnitMirror } from './units.model.mirror';
import ModelTypes from './units.modeltypes.cjs';
import rxjs from 'rxjs';

const { Model } = Sequelize;

const virtualColumns = {
  unitBlockStart: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      return rawValue.split('-')[0];
    },
  },
  unitBlockEnd: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      return rawValue.split('-')[1];
    },
  },
  unitCount: {
    type: Sequelize.VIRTUAL,
    get() {
      const rawValue = this.getDataValue('serialNumberBlock');
      const blocks = rawValue.split('-');
      const blockStart = Number(blocks[0].split(/(\d+)/)[1]);
      const blockEnd = Number(blocks[1].split(/(\d+)/)[1]);
      return blockEnd - blockStart;
    },
  },
};

class Unit extends Model {
  static changes = new rxjs.Subject();
  static defaultColumns = Object.keys(
    Object.assign({}, ModelTypes, virtualColumns),
  );

  static associate() {
    Unit.hasOne(Vintage);

    // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
    Unit.belongsToMany(Qualification, {
      through: 'qualification_unit',
      as: 'qualifications',
    });

    if (process.env.DB_USE_MIRROR === 'true') {
      UnitMirror.hasOne(Vintage);

      // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
      UnitMirror.belongsToMany(Qualification, {
        through: 'qualification_unit',
        as: 'qualifications',
      });
    }
  }

  static async create(values, options) {
    if (process.env.DB_USE_MIRROR === 'true') {
      UnitMirror.create(values, options);
    }

    const createResult = await super.create(values, options);
    const { orgUid } = createResult;

    Unit.changes.next(['units', orgUid]);

    return createResult;
  }

  static async destroy(values) {
    if (process.env.DB_USE_MIRROR === 'true') {
      UnitMirror.destroy(values);
    }
    const record = await super.findOne(values.where);
    const { orgUid } = record.dataValues;

    Unit.changes.next(['units', orgUid]);

    return super.destroy(values);
  }
}

Unit.init(Object.assign({}, ModelTypes, virtualColumns), {
  sequelize,
  modelName: 'unit',
  foreignKey: 'unitId',
});

export { Unit };
