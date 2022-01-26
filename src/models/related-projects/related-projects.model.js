'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../database';

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

  static async destroy(values) {
    safeMirrorDbHandler(() => RelatedProjectMirror.destroy(values));
    return super.destroy(values);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => RelatedProjectMirror.upsert(values, options));
    return super.create(values, options);
  }
}

RelatedProject.init(ModelTypes, {
  sequelize,
  modelName: 'relatedProject',
  timestamps: true,
});

export { RelatedProject };
