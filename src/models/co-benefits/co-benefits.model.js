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
    safeMirrorDbHandler(() => CoBenefitMirror.create(values, options));
    return super.create(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => CoBenefitMirror.upsert(values, options));
    return super.upsert(values, options);
  }

  static async destroy(values, options) {
    safeMirrorDbHandler(() => CoBenefitMirror.destroy(values, options));
    return super.destroy(values, options);
  }
}

CoBenefit.init(ModelTypes, {
  sequelize,
  modelName: 'coBenefit',
  timestamps: true,
});

export { CoBenefit };
