'use strict';

import { Model } from 'sequelize';
import { sequelize, mirrorDBEnabled, mirrorWrite } from '../../database';
import { Project } from '../projects';
import { Unit } from '../units';

import ModelTypes from './labels.modeltypes.js';
import { LabelMirror } from './labels.model.mirror';

class Label extends Model {
  static associate() {
    Label.belongsTo(Project, {
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    // https://gist.github.com/elliette/20ddc4e827efd9d62bc98752e7a62610#some-important-addendums
    Label.belongsToMany(Unit, {
      foreignKey: 'labelId',
      through: 'label_unit',
      as: 'unit',
    });

    // Mirror associations are pure Sequelize metadata - no DB I/O. Gate
    // on mirrorDBEnabled() rather than safeMirrorDbHandler() so we don't
    // authenticate at module load. See projects.model.js for full
    // rationale (parallel-backfill race).
    if (mirrorDBEnabled()) {
      LabelMirror.belongsTo(Project, {
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });

      LabelMirror.belongsToMany(Unit, {
        foreignKey: 'labelId',
        through: 'label_unit',
        as: 'unit',
      });
    }
  }

  static async create(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelMirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.create(values, options);
  }

  static async destroy(options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelMirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    return super.destroy(options);
  }

  static async upsert(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await LabelMirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.upsert(values, options);
  }
}

Label.init(ModelTypes, {
  sequelize,
  modelName: 'label',
  timestamps: true,
});

export { Label };
