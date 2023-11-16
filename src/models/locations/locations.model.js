'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelize, safeMirrorDbHandler } from '../../database';
import { Project } from '../projects';
import { Unit } from '../units';

import ModelTypes from './locations.modeltypes.cjs';
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
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectLocationMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectLocationMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await ProjectLocationMirror.upsert(values, mirrorOptions);
    });
    return super.upsert(values, options);
  }
}

ProjectLocation.init(ModelTypes, {
  sequelize,
  modelName: 'projectLocation',
  timestamps: true,
});

export { ProjectLocation };
