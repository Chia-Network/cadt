'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
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
  }
}

CoBenefit.init(ModelTypes, {
  sequelize,
  modelName: 'coBenefit',
});

export { CoBenefit };
