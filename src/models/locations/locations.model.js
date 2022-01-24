'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { sequelize, safeMirrorDbHandler } from '../database';
import { Project } from '../projects';

import ModelTypes from './locations.modeltypes.cjs';
import { ProjectLocationMirror } from './locations.model.mirror';

class ProjectLocation extends Model {
  static associate() {
    ProjectLocation.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
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

  static async destroy(values) {
    safeMirrorDbHandler(() => ProjectLocationMirror.destroy(values));
    return super.destroy(values);
  }

  static async generateChangeListFromStagedData(
    // eslint-disable-next-line
    action,
    // eslint-disable-next-line
    id,
    // eslint-disable-next-line
    stagedData,
  ) {
    return {};
  }
}

ProjectLocation.init(ModelTypes, {
  sequelize,
  modelName: 'projectLocation',
});

export { ProjectLocation };
