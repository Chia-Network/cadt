import { Sequelize } from 'sequelize';
import config from '../config/config.cjs';
import dotenv from 'dotenv';
dotenv.config();

// possible values: local, test
export const sequelize = new Sequelize(config[process.env.NODE_ENV]);

const mirrorConfig = process.env.NODE_ENV === 'local' ? 'mirror' : 'mirrorTest';
export const sequelizeMirror = new Sequelize(config[mirrorConfig]);

export const safeMirrorDbHandler = (callback) => {
  sequelizeMirror
    .authenticate()
    .then(() => {
      callback();
    })
    .catch(() => {
      console.log('Mirror DB not connected');
    });
};

export const sanitizeSqliteFtsQuery = (query) => {
  query = query.replace(/[-](?=.*[-])/g, "+"); // Replace all but the final dash
  query = query.replace('-', ''); //Replace the final dash with nothing
  query += '*'; // Query should end with asterisk for partial matching
  return query;
}