'use strict';

import { Sequelize, Model } from 'sequelize';
import * as rxjs from 'rxjs';
import { sequelizeV2 as getSequelizeV2 } from '../../database/v2/index.js';
import ModelTypes from './project-methodology-v2.modeltypes.cjs';

class ProjectMethodologyV2 extends Model {
  static changes = new rxjs.Subject();
  static defaultColumns = Object.keys(ModelTypes);

  static associate() {
    // Associations will be set up in database index
  }

  static async create(values, options) {
    const result = await super.create(values, options);
    this.changes.next({ action: 'create', data: result });
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    this.changes.next({ action: 'destroy', data: result });
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    this.changes.next({ action: 'upsert', data: result });
    return result;
  }
}

ProjectMethodologyV2.init(ModelTypes, {
  sequelize: getSequelizeV2(),
  modelName: 'project-methodology',
  tableName: 'project_methodology',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  timezone: '+00:00',
  useHooks: true,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  },
  dialectOptions: {
    charset: 'utf8mb4',
    dateStrings: true,
    typeCast: true,
  },
});

export { ProjectMethodologyV2 };
