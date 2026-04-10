import _ from 'lodash';
import fs from 'fs';
import path from 'path';
import { Sequelize, QueryTypes } from 'sequelize';
import os from 'os';
import config from '../config/config.js';
import { logger } from '../config/logger.js';
import mysql from 'mysql2/promise';
import { getConfig } from '../utils/config-loader';

import { migrations } from './migrations';
import { seeders } from './seeders';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// possible values: local, test
const nodeEnv = process.env.NODE_ENV || 'local';
const dbConfigKey = nodeEnv;

// Safety check: In test mode, ensure we're using test database configuration
if (nodeEnv === 'test') {
  const testConfig = config[dbConfigKey];
  if (!testConfig || !testConfig.storage || !testConfig.storage.includes('test')) {
    const errorMsg = `SAFETY CHECK FAILED: Test mode detected but database config '${dbConfigKey}' does not appear to be a test database. Storage: ${testConfig?.storage || 'undefined'}. This prevents accidental production database access.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  // Additional check: test database should be under tests/test-dbs/, not in home directory
  if (testConfig.storage.includes('~') || testConfig.storage.includes(os.homedir())) {
    const errorMsg = `SAFETY CHECK FAILED: Test database path appears to be in home directory: ${testConfig.storage}. Test databases must be under tests/test-dbs/.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  // Ensure test database directory exists
  const dbDir = path.dirname(testConfig.storage);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

export const sequelize = new Sequelize(config[dbConfigKey]);

const mirrorConfig =
  (process.env.NODE_ENV || 'local') === 'local' ? 'mirror' : 'mirrorTest';
export const sequelizeMirror = new Sequelize(config[mirrorConfig]);

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
    try {
      const connection = await mysql.createConnection({
        host: getConfig().MIRROR_DB.DB_HOST,
        port: 3306,
        user: getConfig().MIRROR_DB.DB_USERNAME,
        password: getConfig().MIRROR_DB.DB_PASSWORD,
      });

      try {
        await connection.query(
          `CREATE DATABASE IF NOT EXISTS \`${getConfig().MIRROR_DB.DB_NAME}\`;`,
        );
      } finally {
        await connection.end();
      }

      const db = new Sequelize(config[mirrorConfig]);

      await checkForMigrations(db);
    } catch (error) {
      // Non-fatal: mirror DB failure should not block main database startup
      logger.error('[v1]: Error setting up MySQL mirror database:', error);
    }
  } else if (mirrorConfig == 'mirrorTest') {
    await checkForMigrations(sequelizeMirror);
  }

  await checkForMigrations(sequelize);
};

// Function to set WAL mode
async function setWALMode() {
  try {
    await sequelize.authenticate();
    await sequelize.query('PRAGMA journal_mode=WAL;', { type: QueryTypes.RAW });
    console.log('WAL mode set successfully.');
  } catch (error) {
    console.error('Unable to set WAL mode:', error);
  }
}

setWALMode();
