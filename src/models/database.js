import { Sequelize } from 'sequelize';
import config from '../config/config.cjs';
import Debug from 'debug';
Debug.enable('climate-warehouse:mirror-database');
const log = Debug('climate-warehouse:mirror-database');

import dotenv from 'dotenv';
dotenv.config();

// possible values: local, test
export const sequelize = new Sequelize(config[process.env.NODE_ENV || 'local']);

const mirrorConfig =
  (process.env.NODE_ENV || 'local') === 'local' ? 'mirror' : 'mirrorTest';
export const sequelizeMirror = new Sequelize(config[mirrorConfig]);

export const safeMirrorDbHandler = (callback) => {
  sequelizeMirror
    .authenticate()
    .then(() => {
      callback();
    })
    .catch(() => {
      if (process.env.DB_HOST || process.env.DB_HOST !== '') {
        log('Mirror DB not connected');
      }
    });
};

export const sanitizeSqliteFtsQuery = (query) => {
  query = query.replace(/[-](?=.*[-])/g, '+'); // Replace all but the final dash
  query = query.replace('-', ''); //Replace the final dash with nothing
  query += '*'; // Query should end with asterisk for partial matching
  return query;
};
