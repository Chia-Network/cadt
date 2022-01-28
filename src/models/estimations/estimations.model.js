'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { EstimationMirror } from './estimations.model.mirror';
import { sequelize, safeMirrorDbHandler } from '../database';
import { Project } from '../projects';
import ModelTypes from './estimations.modeltypes.cjs';

class Estimation extends Model {
  static associate() {
    Estimation.belongsTo(Project, {
      onDelete: 'CASCADE',
      targetKey: 'warehouseProjectId',
      foreignKey: 'warehouseProjectId',
    });

    safeMirrorDbHandler(() => {
      EstimationMirror.belongsTo(Project, {
        onDelete: 'CASCADE',
        targetKey: 'warehouseProjectId',
        foreignKey: 'warehouseProjectId',
      });
    });
  }

  static async create(values, options) {
    safeMirrorDbHandler(() => EstimationMirror.create(values, options));
    return super.create(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => EstimationMirror.upsert(values, options));
    return super.create(values, options);
  }

  static async destroy(values) {
    safeMirrorDbHandler(() => EstimationMirror.destroy(values));
    return super.destroy(values);
  }
}

Estimation.init(ModelTypes, {
  sequelize,
  modelName: 'estimation',
  timestamps: true,
});

export { Estimation };
