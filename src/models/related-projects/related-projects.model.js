'use strict';
import { Model } from 'sequelize';
import { sequelize, mirrorDBEnabled, mirrorWrite } from '../../database';

import ModelTypes from './related-projects.modeltypes.js';
import { RelatedProjectMirror } from './related-projects.model.mirror';

import { Project } from '../projects';

class RelatedProject extends Model {
  static associate() {
    RelatedProject.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    // Mirror associations are pure Sequelize metadata - no DB I/O. Gate
    // on mirrorDBEnabled() rather than safeMirrorDbHandler() so we don't
    // authenticate at module load. See projects.model.js for full
    // rationale (parallel-backfill race).
    if (mirrorDBEnabled()) {
      RelatedProjectMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
    }
  }

  static async create(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await RelatedProjectMirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.create(values, options);
  }

  static async destroy(options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await RelatedProjectMirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    return super.destroy(options);
  }

  static async upsert(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await RelatedProjectMirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.upsert(values, options);
  }
}

RelatedProject.init(ModelTypes, {
  sequelize,
  modelName: 'relatedProject',
  timestamps: true,
});

export { RelatedProject };
