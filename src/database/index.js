import { Sequelize } from 'sequelize';
import config from '../config/config.cjs';
import Debug from 'debug';
Debug.enable('climate-warehouse:mirror-database');
const log = Debug('climate-warehouse:mirror-database');
import mysql from 'mysql2/promise';

import { migrations } from './migrations';
import { seeders } from './seeders';

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
      if (process.env.DB_HOST && process.env.DB_HOST !== '') {
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

export const seedDb = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    for (let i = 0; i < seeders.length; i++) {
      const seeder = seeders[i];
      console.log('SEEDING: ', seeder.name);
      await seeder.seed.up(queryInterface, Sequelize);
    }
  } catch (error) {
    log(error);
  }
};

export const checkForMigrations = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    await queryInterface.createTable('SequelizeMeta', {
      name: Sequelize.STRING,
    });

    const completedMigrations = await db.query(
      'SELECT * FROM `SequelizeMeta`',
      {
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const notCompletedMigrations = migrations.filter((migration) => {
      return !completedMigrations
        .map((complete) => complete.name)
        .includes(migration.name);
    });

    for (let i = 0; i < notCompletedMigrations.length; i++) {
      const notCompleted = notCompletedMigrations[i];
      console.log('MIGRATING: ', notCompleted.name);
      await notCompleted.migration.up(db.queryInterface, Sequelize);
      await db.query('INSERT INTO `SequelizeMeta` VALUES(:name)', {
        type: Sequelize.QueryTypes.INSERT,
        replacements: { name: notCompleted.name },
      });
    }
  } catch (error) {
    log(error);
  }
};

export const prepareDb = async () => {
  const mirrorConfig =
    (process.env.NODE_ENV || 'local') === 'local' ? 'mirror' : 'mirrorTest';

  if (
    mirrorConfig == 'mirror' &&
    process.env.DB_HOST &&
    process.env.DB_HOST !== ''
  ) {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: 3306,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`,
    );

    const db = new Sequelize(config[mirrorConfig]);

    await checkForMigrations(db);
  } else if (mirrorConfig == 'mirrorTest') {
    await checkForMigrations(sequelizeMirror);
  }

  await checkForMigrations(sequelize);
};
