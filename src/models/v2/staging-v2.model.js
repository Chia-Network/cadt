'use strict';

import _ from 'lodash';
import { uuid as uuidv4 } from 'uuidv4';
import { Sequelize, Model } from 'sequelize';
const Op = Sequelize.Op;

import { logger } from '../../config/logger';

import * as rxjs from 'rxjs';
import { sequelizeV2 as getSequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './staging-v2.modeltypes.cjs';

class StagingV2 extends Model {
  static changes = new rxjs.Subject();
  static defaultColumns = Object.keys(ModelTypes);

  static associate() {
    // No associations for staging table
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

StagingV2.init(ModelTypes, {
  sequelize: getSequelizeV2(),
  modelName: 'staging',
  timestamps: true,
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

export { StagingV2 };
