'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelize, safeMirrorDbHandler } from '../../database';
import { Project } from '../projects';

import ModelTypes from './locations.modeltypes.cjs';
import { ProjectLocationMirror } from './locations.model.mirror';
import { Unit } from '../units';

class ProjectLocation extends Model {
  static associate() {
    ProjectLocation.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    ProjectLocation.belongsTo(Unit, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseUnitId',
      foreignKey: 'warehouseUnitId',
    });

    safeMirrorDbHandler(() => {
      ProjectLocationMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => ProjectLocationMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values, options) {
    safeMirrorDbHandler(() => ProjectLocationMirror.destroy(values, options));
    return super.destroy(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => ProjectLocationMirror.upsert(values, options));
    return super.upsert(values, options);
  }
}

ProjectLocation.init(ModelTypes, {
  sequelize,
  modelName: 'projectLocation',
  timestamps: true,
});

export { ProjectLocation };
