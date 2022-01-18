'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

import ModelTypes from './organizations.modeltypes.cjs';

class Organization extends Model {
  static async getHomeOrg() {
    return {
      'f1c54511-865e-4611-976c-7c3c1f704662': {
        name: 'Chia Demo Organization',
        icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/me.svg',
        writeAccess: true,
      },
    };
  }

  static async getOrgsMap() {
    const homeOrg = await Organization.getHomeOrg();
    const stubbedOrganizations = {
      ...homeOrg,
      '35f92331-c8d7-4e9e-a8d2-cd0a86cbb2cf': {
        name: 'chili',
        icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/chili.svg',
      },
      'fbffae6b-0203-4ac0-a08b-1551b730783b': {
        name: 'belgium',
        icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/belgium.svg',
      },
      '70150fde-57f6-44a6-9486-1fef49528475': {
        name: 'bulgaria',
        icon: 'https://climate-warehouse.s3.us-west-2.amazonaws.com/public/orgs/bulgaria.svg',
      },
    };
    return stubbedOrganizations;
  }
}

Organization.init(ModelTypes, {
  sequelize,
  modelName: 'organization',
});

export { Organization };
