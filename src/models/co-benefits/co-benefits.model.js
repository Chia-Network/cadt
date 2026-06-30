'use strict';
import { Model } from 'sequelize';

import { CoBenefitMirror } from './co-benefits.model.mirror';
import { sequelize, mirrorDBEnabled, mirrorWrite } from '../../database';
import { Project } from '../projects';
import ModelTypes from './co-benefits.modeltypes.js';

class CoBenefit extends Model {
  static associate() {
    CoBenefit.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    // Mirror associations are pure Sequelize metadata - no DB I/O. Gate
    // on mirrorDBEnabled() rather than safeMirrorDbHandler() so we don't
    // authenticate at module load. See projects.model.js for full
    // rationale (parallel-backfill race).
    if (mirrorDBEnabled()) {
      CoBenefitMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
    }
  }

  static async create(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await CoBenefitMirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.create(values, options);
  }

  static async upsert(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await CoBenefitMirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.upsert(values, options);
  }

  static async destroy(options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await CoBenefitMirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    return super.destroy(options);
  }
}

CoBenefit.init(ModelTypes, {
  sequelize,
  modelName: 'coBenefit',
  timestamps: true,
});

export { CoBenefit };
