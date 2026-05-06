'use strict';
import { Model } from 'sequelize';

import { EstimationMirror } from './estimations.model.mirror';
import { sequelize, safeMirrorDbHandler, mirrorWrite } from '../../database';
import { Project } from '../projects';
import ModelTypes from './estimations.modeltypes.js';

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
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };

      await EstimationMirror.create(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.create(values, options);
  }

  static async upsert(values, options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await EstimationMirror.upsert(values, mirrorOptions);
    }, options?.mirrorTransaction);
    return super.upsert(values, options);
  }

  static async destroy(options) {
    await mirrorWrite(async () => {
      const mirrorOptions = {
        ...options,
        transaction: options?.mirrorTransaction,
      };
      await EstimationMirror.destroy(mirrorOptions);
    }, options?.mirrorTransaction);
    return super.destroy(options);
  }
}

Estimation.init(ModelTypes, {
  sequelize,
  modelName: 'estimation',
  timestamps: true,
});

export { Estimation };
