'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

import ModelTypes from './organizations.modeltypes.cjs';

class Organization extends Model {
  static async getHomeOrg() {
    return {
      'f1c54511-865e-4611-976c-7c3c1f704662': {
        name: 'Chia',
        icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg',
        writeAccess: true,
      },
    };
  }
}

Organization.init(ModelTypes, {
  sequelize,
  modelName: 'organization',
});

export { Organization };
