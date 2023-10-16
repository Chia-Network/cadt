import _ from 'lodash';
import { Sequelize } from 'sequelize';
import config from '../config/config.js';
import { logger } from '../config/logger.cjs';
import mysql from 'mysql2/promise';
import { getConfig } from '../utils/config-loader';

import { migrations } from './migrations';
import { seeders } from './seeders';

import dotenv from 'dotenv';
dotenv.config();

// possible values: local, test
export const sequelize = new Sequelize(config[process.env.NODE_ENV || 'local']);

const mirrorConfig =
  (process.env.NODE_ENV || 'local') === 'local' ? 'mirror' : 'mirrorTest';
export const sequelizeMirror = new Sequelize(config[mirrorConfig]);

logger.info('CADT:mirror-database');

const logDebounce = _.debounce(() => {
  console.log('Mirror DB not connected');
  logger.info('Mirror DB not connected');
}, 120000);

export const mirrorDBEnabled = () => {
  const CONFIG = getConfig();
  if (
    mirrorConfig === 'mirror' &&
    (!CONFIG?.MIRROR_DB?.DB_HOST ||
      !CONFIG?.MIRROR_DB?.DB_NAME ||
      !CONFIG?.MIRROR_DB?.DB_USERNAME ||
      !CONFIG?.MIRROR_DB?.DB_PASSWORD)
  ) {
    return false;
  }

  return true;
};

export const safeMirrorDbHandler = (callback) => {
  if (!mirrorDBEnabled()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      sequelizeMirror
        .authenticate()
        .then(async () => {
          try {
            await callback();
          } catch (e) {
            logger.error(`mirror_error:${e.message}`);
          }
        })
        .catch(() => {
          logDebounce();
        });
    } catch (error) {
      logger.error(
        'MirrorDB tried to update before it was initialize, will try again later',
        error,
      );
    } finally {
      resolve();
    }
  });
};

export const sanitizeSqliteFtsQuery = (query) => {
  query = query.replace(/[-](?=.*[-])/g, '+'); // Replace all but the final dash
  query = query.replace('-', ''); //Replace the final dash with nothing
  query = query.replace(/([.?*+^$[\]\\(){}|-])/g, '"$1"');
  query += '*'; // Query should end with asterisk for partial matching
  return query;
};

export const seedDb = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    for (let i = 0; i < seeders.length; i++) {
      const seeder = seeders[i];
      logger.info(`SEEDING: ${seeder.name}`, seeder);
      await seeder.seed.up(queryInterface, Sequelize);
    }
  } catch (error) {
    logger.error('Error seeding data', error);
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
      try {
        const notCompleted = notCompletedMigrations[i];
        logger.info(`MIGRATING: ${notCompleted.name}`);
        await notCompleted.migration.up(db.queryInterface, Sequelize);
        await db.query('INSERT INTO `SequelizeMeta` VALUES(:name)', {
          type: Sequelize.QueryTypes.INSERT,
          replacements: { name: notCompleted.name },
        });
      } catch (e) {
        logger.error('Migration not completed', e);
      }
    }
  } catch (error) {
    logger.error('Error checking for migrations', error);
  }
};

export const prepareDb = async () => {
  const mirrorConfig =
    (process.env.NODE_ENV || 'local') === 'local' ? 'mirror' : 'mirrorTest';

  if (
    mirrorConfig == 'mirror' &&
    getConfig().MIRROR_DB.DB_HOST &&
    getConfig().MIRROR_DB.DB_HOST !== ''
  ) {
    const connection = await mysql.createConnection({
      host: getConfig().MIRROR_DB.DB_HOST,
      port: 3306,
      user: getConfig().MIRROR_DB.DB_USERNAME,
      password: getConfig().MIRROR_DB.DB_PASSWORD,
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${getConfig().MIRROR_DB.DB_NAME}\`;`,
    );

    const db = new Sequelize(config[mirrorConfig]);

    await checkForMigrations(db);
  } else if (mirrorConfig == 'mirrorTest') {
    await checkForMigrations(sequelizeMirror);
  }

  await checkForMigrations(sequelize);
};
