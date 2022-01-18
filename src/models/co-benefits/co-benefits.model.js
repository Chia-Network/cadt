'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { CoBenefitMirror } from './co-benefits.model.mirror';
import { sequelize, safeMirrorDbHandler } from '../database';
import { Project } from '../projects';
import ModelTypes from './co-benifets.modeltypes.cjs';

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

  static async destroy(values) {
    safeMirrorDbHandler(() => CoBenefitMirror.destroy(values));
    return super.destroy(values);
  }
}

CoBenefit.init(ModelTypes, {
  sequelize,
  modelName: 'coBenefit',
});

export { CoBenefit };
