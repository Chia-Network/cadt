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
      foreignKey: {
        allowNull: false,
      },
    });
  }
}

CoBenefit.init(ModelTypes, {
  sequelize,
  modelName: 'coBenefit',
});

export { CoBenefit };
