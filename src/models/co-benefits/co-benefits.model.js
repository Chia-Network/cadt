'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { CoBenefitMirror } from './co-benefits.model.mirror';
import { sequelize } from '../database';
import { Project } from '../projects';
import ModelTypes from './co-benifets.modeltypes.cjs';

class CoBenefit extends Model {
  static associate() {
    CoBenefit.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'projectId',
    });

    if (process.env.DB_USE_MIRROR === 'true') {
      CoBenefitMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'projectId',
      });
    }
  }

  static async create(values, options) {
    CoBenefitMirror.create(values, options);
    return super.create(values, options);
  }

  static async destroy(values) {
    CoBenefitMirror.destroy(values);
    return super.destroy(values);
  }
}

CoBenefit.init(ModelTypes, {
  sequelize,
  modelName: 'coBenefit',
});

export { CoBenefit };
