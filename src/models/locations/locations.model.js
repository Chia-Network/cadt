'use strict';

import { Model } from 'sequelize';

import { sequelize, safeMirrorDbHandler, mirrorWrite } from '../../database';
import { Project } from '../projects';
import { Unit } from '../units';

import ModelTypes from './locations.modeltypes.js';
import { ProjectLocationMirror } from './locations.model.mirror';

class ProjectLocation extends Model {
  static associate() {
    ProjectLocation.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    ProjectLocation.hasOne(Unit, {
      targetKey: 'projectLocationId',
      foreignKey: 'projectLocationId',
    });

    safeMirrorDbHandler(() => {
      ProjectLocationMirror.hasOne(Unit);
      ProjectLocationMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
    });
  }

  static async create(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectLocationMirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.create(values, options);
  }

  static async destroy(options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectLocationMirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    return super.destroy(options);
  }

  static async upsert(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectLocationMirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.upsert(values, options);
  }
}

ProjectLocation.init(ModelTypes, {
  sequelize,
  modelName: 'projectLocation',
  timestamps: true,
});

export { ProjectLocation };
