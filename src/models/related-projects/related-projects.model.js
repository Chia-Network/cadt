'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

import ModelTypes from './related-projects.modeltypes.cjs';
import { RelatedProjectMirror } from './related-projects.model.mirror';

import { Project } from '../projects';

class RelatedProject extends Model {
  static associate() {
    RelatedProject.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'projectId',
    });

    if (process.env.DB_USE_MIRROR === 'true') {
      RelatedProjectMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'projectId',
      });
    }
  }

  static async create(values, options) {
    if (process.env.DB_USE_MIRROR === 'true') {
      RelatedProjectMirror.create(values, options);
    }
    return super.create(values, options);
  }

  static async destroy(values) {
    if (process.env.DB_USE_MIRROR === 'true') {
      RelatedProjectMirror.destroy(values);
    }
    return super.destroy(values);
  }
}

RelatedProject.init(ModelTypes, {
  sequelize,
  modelName: 'relatedProject',
});

export { RelatedProject };
