'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize, Model } from 'sequelize';
const Op = Sequelize.Op;

import * as rxjs from 'rxjs';

import { sequelizeV2 } from '../../database/v2/index.js';

import ModelTypes from './staging-v2.modeltypes.cjs';

class StagingV2 extends Model {
  static changes = new rxjs.Subject();

  static async create(values, options) {
    StagingV2.changes.next(['staging']);
    return super.create(values, options);
  }

  static async destroy(values) {
    StagingV2.changes.next(['staging']);
    return super.destroy(values);
  }

  static async upsert(values, options) {
    StagingV2.changes.next(['staging']);
    return super.upsert(values, options);
  }

  // V2-specific staging methods will be added here as needed
}

StagingV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'StagingV2',
  tableName: 'staging',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default StagingV2;
