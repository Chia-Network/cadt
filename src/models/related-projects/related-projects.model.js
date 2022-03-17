'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database';

import ModelTypes from './related-projects.modeltypes.cjs';
import { RelatedProjectMirror } from './related-projects.model.mirror';

import { Project } from '../projects';

class RelatedProject extends Model {
  static associate() {
    RelatedProject.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    safeMirrorDbHandler(() => {
      RelatedProjectMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => RelatedProjectMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values, options) {
    safeMirrorDbHandler(() => RelatedProjectMirror.destroy(values, options));
    return super.destroy(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => RelatedProjectMirror.upsert(values, options));
    return super.upsert(values, options);
  }
}

RelatedProject.init(ModelTypes, {
  sequelize,
  modelName: 'relatedProject',
  timestamps: true,
});

export { RelatedProject };
