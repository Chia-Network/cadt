'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize, safeMirrorDbHandler } from '../../database';
import { AuditMirror } from './audit.model.mirror';
import ModelTypes from './audit.modeltypes.cjs';
import findDuplicateIssuancesSql from './sql/find-duplicate-issuances.sql.js';

class Audit extends Model {
  static async create(values, options) {
    safeMirrorDbHandler(() => AuditMirror.create(values, options));
    return super.create(values, options);
  }

  static async destroy(values, options) {
    safeMirrorDbHandler(() => AuditMirror.destroy(values, options));
    return super.destroy(values, options);
  }

  static async upsert(values, options) {
    safeMirrorDbHandler(() => AuditMirror.upsert(values, options));
    return super.upsert(values, options);
  }

  static async findConflicts() {
    const [results] = await sequelize.query(findDuplicateIssuancesSql);
    return results;
  }
}

Audit.init(ModelTypes, {
  sequelize,
  modelName: 'audit',
  freezeTableName: true,
  timestamps: true,
  createdAt: true,
  updatedAt: true,
});

export { Audit };
