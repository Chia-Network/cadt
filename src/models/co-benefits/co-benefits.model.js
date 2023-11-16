'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { CoBenefitMirror } from './co-benefits.model.mirror';
import { sequelize, safeMirrorDbHandler } from '../../database';
import { Project } from '../projects';
import ModelTypes from './co-benefits.modeltypes.cjs';

class CoBenefit extends Model {
  static associate() {
    CoBenefit.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    safeMirrorDbHandler(() => {
      CoBenefitMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await CoBenefitMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await CoBenefitMirror.upsert(values, mirrorOptions);
    });
    return super.upsert(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await CoBenefitMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }
}

CoBenefit.init(ModelTypes, {
  sequelize,
  modelName: 'coBenefit',
  timestamps: true,
});

export { CoBenefit };
