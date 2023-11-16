'use strict';
import Sequelize from 'sequelize';
const { Model } = Sequelize;

import { EstimationMirror } from './estimations.model.mirror';
import { sequelize, safeMirrorDbHandler } from '../../database';
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
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };

      await EstimationMirror.create(values, mirrorOptions);
    });
    return super.create(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await EstimationMirror.upsert(values, mirrorOptions);
    });
    return super.upsert(values, options);
  }

  static async destroy(options) {
    safeMirrorDbHandler(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await EstimationMirror.destroy(mirrorOptions);
    });
    return super.destroy(options);
  }
}

Estimation.init(ModelTypes, {
  sequelize,
  modelName: 'estimation',
  timestamps: true,
});

export { Estimation };
