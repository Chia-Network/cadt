'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelize } from '../database';
import { Project } from '../projects';

import ModelTypes from './locations.modeltypes.cjs';
import { ProjectLocationMirror } from './locations.model.mirror';

class ProjectLocation extends Model {
  static associate() {
    ProjectLocation.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'projectId',
    });

    if (process.env.DB_USE_MIRROR === 'true') {
      ProjectLocationMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'projectId',
      });
    }
  }

  static async create(values, options) {
    if (process.env.DB_USE_MIRROR === 'true') {
      ProjectLocationMirror.create(values, options);
    }
    return super.create(values, options);
  }

  static async destroy(values) {
    if (process.env.DB_USE_MIRROR === 'true') {
      ProjectLocationMirror.destroy(values);
    }
    return super.destroy(values);
  }
}

ProjectLocation.init(ModelTypes, {
  sequelize,
  modelName: 'projectLocation',
});

export { ProjectLocation };
