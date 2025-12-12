import { Sequelize, QueryTypes } from 'sequelize';
import os from 'os';
import config from '../../config/config.js';
import { loggerV2 } from '../../config/logger.js';
import mysql from 'mysql2/promise';
import { getConfig } from '../../utils/config-loader';

import { migrations } from './migrations';
import { seeders } from './seeders';

import dotenv from 'dotenv';
dotenv.config();

// possible values: local, test
const nodeEnv = process.env.NODE_ENV;
const dbConfigKey = nodeEnv ? `v2${nodeEnv.charAt(0).toUpperCase() + nodeEnv.slice(1)}` : 'v2Local';

// Safety check: In test mode, ensure we're using test database configuration
if (nodeEnv === 'test') {
  const testConfig = config[dbConfigKey];
  if (!testConfig || !testConfig.storage || !testConfig.storage.includes('test')) {
    const errorMsg = `SAFETY CHECK FAILED: Test mode detected but V2 database config '${dbConfigKey}' does not appear to be a test database. Storage: ${testConfig?.storage || 'undefined'}. This prevents accidental production database access.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  // Additional check: test database should be in project root (relative path), not in home directory
  if (testConfig.storage.includes('~') || testConfig.storage.includes(os.homedir())) {
    const errorMsg = `SAFETY CHECK FAILED: V2 test database path appears to be in home directory: ${testConfig.storage}. Test databases must be in project root (relative paths like './test-v2.sqlite3').`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

export const sequelizeV2 = new Sequelize(config[dbConfigKey]);

const mirrorConfig =
  (process.env.NODE_ENV || 'local') === 'local' ? 'v2Mirror' : 'v2MirrorTest';

export const sequelizeV2Mirror = new Sequelize(config[mirrorConfig]);

export const mirrorDBEnabledV2 = () => {
  const CONFIG = getConfig();
  if (
    mirrorConfig === 'v2Mirror' &&
    (!CONFIG?.MIRROR_DB?.DB_HOST ||
      !CONFIG?.MIRROR_DB?.DB_NAME ||
      !CONFIG?.MIRROR_DB?.DB_USERNAME ||
      !CONFIG?.MIRROR_DB?.DB_PASSWORD)
  ) {
    return false;
  }

  return true;
};

export const safeMirrorDbHandlerV2 = (callback) => {
  if (!mirrorDBEnabledV2()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      sequelizeV2Mirror
        .authenticate()
        .then(async () => {
          try {
            await callback();
          } catch (e) {
            loggerV2.error(`v2_mirror_error:${e.message}`);
          }
        })
        .catch(() => {
          loggerV2.info('V2 Mirror DB not connected');
        });
    } catch (error) {
      loggerV2.error(
        'V2 MirrorDB tried to update before it was initialize, will try again later',
        error,
      );
    } finally {
      resolve();
    }
  });
};

export const seedV2Db = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    for (let i = 0; i < seeders.length; i++) {
      const seeder = seeders[i];
      loggerV2.info(`SEEDING V2: ${seeder.name}`, seeder);
      await seeder.seed.up(queryInterface, Sequelize);
    }
  } catch (error) {
    loggerV2.error('Error seeding V2 data', error);
  }
};

export const checkForV2Migrations = async (db) => {
  try {
    const queryInterface = db.getQueryInterface();

    await queryInterface.createTable('SequelizeMetaV2', {
      name: Sequelize.STRING,
    });

    const completedMigrations = await db.query(
      'SELECT * FROM `SequelizeMetaV2`',
      {
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const notCompletedMigrations = migrations.filter((migration) => {
      return !completedMigrations
        .map((complete) => complete.name)
        .includes(migration.name);
    });

    // Special handling for FTS triggers migration - verify triggers exist even if marked complete
    const ftsTriggersMigration = migrations.find(m => m.name === '20250110120032-create-fts5-triggers-v2');
    if (ftsTriggersMigration && db.getDialect() === 'sqlite') {
      const isCompleted = completedMigrations.some(m => m.name === ftsTriggersMigration.name);
      if (isCompleted) {
        // Verify triggers actually exist
        const triggerCheck = await db.query(
          "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%v2%fts%'",
          { type: Sequelize.QueryTypes.SELECT },
        );
        if (triggerCheck.length !== 6) {
          loggerV2.warn(`FTS triggers missing (found ${triggerCheck.length}, expected 6), re-running migration`);
          // Remove from completed migrations so it runs again
          await db.query('DELETE FROM `SequelizeMetaV2` WHERE name = :name', {
            replacements: { name: ftsTriggersMigration.name },
            type: Sequelize.QueryTypes.DELETE,
          });
          // Re-add to pending migrations
          notCompletedMigrations.push(ftsTriggersMigration);
        }
      }
    }

    for (let i = 0; i < notCompletedMigrations.length; i++) {
      try {
        const notCompleted = notCompletedMigrations[i];
        loggerV2.info(`V2 MIGRATING: ${notCompleted.name}`);
        await notCompleted.migration.up(db.queryInterface, Sequelize);
        await db.query('INSERT INTO `SequelizeMetaV2` (name) VALUES(:name)', {
          type: Sequelize.QueryTypes.INSERT,
          replacements: { name: notCompleted.name },
        });
      } catch (e) {
        // Check if error is "already exists" - this is OK for idempotent migrations
        const errorMessage = e.message || e.toString();
        const isAlreadyExistsError =
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate column name') ||
          (e.parent && (
            e.parent.code === 'SQLITE_ERROR' &&
            (e.parent.message?.includes('already exists') || e.parent.message?.includes('duplicate')
          )));

        if (isAlreadyExistsError) {
          loggerV2.warn(`V2 Migration ${notCompleted.name} encountered "already exists" error, marking as complete:`, errorMessage);
          // Mark migration as complete even if some parts already exist
          try {
            await db.query('INSERT INTO `SequelizeMetaV2` (name) VALUES(:name)', {
              type: Sequelize.QueryTypes.INSERT,
              replacements: { name: notCompleted.name },
            });
          } catch (insertError) {
            // Ignore if already in meta table
            if (!insertError.message?.includes('UNIQUE constraint')) {
              loggerV2.error('Error marking migration as complete', insertError);
            }
          }
        } else {
          loggerV2.error('V2 Migration not completed', e);
        }
      }
    }
  } catch (error) {
    loggerV2.error('Error checking for V2 migrations', error);
  }
};

export const prepareV2Db = async () => {
  const mirrorConfig =
    (process.env.NODE_ENV || 'local') === 'local' ? 'v2Mirror' : 'v2MirrorTest';

  if (
    mirrorConfig == 'v2Mirror' &&
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
      `CREATE DATABASE IF NOT EXISTS \`${getConfig().MIRROR_DB.DB_NAME}_v2\`;`,
    );

    // Use the exported sequelizeV2Mirror instance instead of creating a new one
    await checkForV2Migrations(sequelizeV2Mirror);
  } else if (mirrorConfig == 'v2MirrorTest') {
    await checkForV2Migrations(sequelizeV2Mirror);
  }

  await checkForV2Migrations(sequelizeV2);
};

async function setV2WALMode() {
  try {
    await sequelizeV2.authenticate();
    await sequelizeV2.query('PRAGMA journal_mode=WAL;', { type: QueryTypes.RAW });
    // Set busy_timeout to 30 seconds (30000ms) to handle concurrent access
    // This tells SQLite to wait up to 30 seconds before returning SQLITE_BUSY
    await sequelizeV2.query('PRAGMA busy_timeout=30000;', { type: QueryTypes.RAW });
    console.log('V2 WAL mode set successfully.');
    console.log('V2 busy_timeout set to 30000ms.');
  } catch (error) {
    console.error('Unable to set V2 WAL mode:', error);
  }
}

setV2WALMode();
