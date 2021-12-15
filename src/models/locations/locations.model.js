'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { Project } from '../projects';

import ModelTypes from './locations.modeltypes.cjs';

class ProjectLocation extends Model {
  static associate() {
    ProjectLocation.belongsTo(Project, {
      onDelete: 'CASCADE',
      foreignKey: {
        allowNull: false,
      },
    });
  }
}

ProjectLocation.init(ModelTypes, {
  sequelize,
  modelName: 'projectLocation',
});

export { ProjectLocation };
