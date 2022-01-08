'use strict';

import fs from 'fs';
import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';

import ModelTypes from './organizations.modeltypes.cjs';

const loadFileIntoString = (path) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, buff) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(buff.toString());
      resolve(buff.toString());
    });
  });
};

class Organization extends Model {
  static async getHomeOrg() {
    return {
      'f1c54511-865e-4611-976c-7c3c1f704662': {
        name: 'Chia',
        icon: await loadFileIntoString('src/assets/organizationIcons/me.svg'),
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
