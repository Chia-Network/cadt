import fs from 'fs';
import path from 'path';
import { Sequelize, QueryTypes } from 'sequelize';
import os from 'os';
import config from '../../config/config.js';
import { loggerV2 } from '../../config/logger.js';
import mysql from 'mysql2/promise';
import { getConfig, getConfigV2 } from '../../utils/config-loader';

import { migrations } from './migrations';
import { seeders } from './seeders';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

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
  // Additional check: test database should be under tests/test-dbs/, not in home directory
  if (testConfig.storage.includes('~') || testConfig.storage.includes(os.homedir())) {
    const errorMsg = `SAFETY CHECK FAILED: V2 test database path appears to be in home directory: ${testConfig.storage}. Test databases must be under tests/test-dbs/.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  // Ensure test database directory exists
  const dbDir = path.dirname(testConfig.storage);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

export const sequelizeV2 = new Sequelize(config[dbConfigKey]);

// Determine if MySQL mirror is configured by checking the actual config values
// This allows MySQL mirror to work in any environment (local, test, production)
const v2MirrorConfig = getConfigV2();
const mysqlMirrorConfigured =
  v2MirrorConfig?.MIRROR_DB?.DB_HOST &&
  v2MirrorConfig?.MIRROR_DB?.DB_HOST !== '' &&
  v2MirrorConfig?.MIRROR_DB?.DB_NAME &&
  v2MirrorConfig?.MIRROR_DB?.DB_USERNAME &&
  v2MirrorConfig?.MIRROR_DB?.DB_PASSWORD;

// Use MySQL config (v2Mirror) if configured, otherwise fall back to SQLite test config
const mirrorConfig = mysqlMirrorConfigured ? 'v2Mirror' : 'v2MirrorTest';

loggerV2.info(`[v2]: Mirror DB config selected: ${mirrorConfig} (MySQL configured: ${!!mysqlMirrorConfigured})`);

export const sequelizeV2Mirror = new Sequelize(config[mirrorConfig]);

export const mirrorDBEnabledV2 = () => {
  // Mirror DB is only enabled if MySQL is actually configured
  // In test mode without MySQL, mirror operations should be no-ops
  return mysqlMirrorConfigured;
};

/**
 * Validate that V1 and V2 mirror database names are different when both are configured.
 * Throws an error if both V1 and V2 MIRROR_DB.DB_NAME are set to the same non-empty value.
 *
 * @param {object} v1Config - The V1 config object (from getConfig())
 * @param {object} v2Config - The V2 config object (from getConfigV2())
 * @throws {Error} if V1 and V2 mirror DB names are the same
 */
export const validateMirrorDbNames = (v1Config, v2Config) => {
  const v1DbName = v1Config?.MIRROR_DB?.DB_NAME;
  const v2DbName = v2Config?.MIRROR_DB?.DB_NAME;

  if (v1DbName && v2DbName && v1DbName === v2DbName) {
    throw new Error(
      `V1 and V2 mirror databases must use different database names, ` +
      `but both are set to '${v1DbName}'. ` +
      `Update MIRROR_DB.DB_NAME in your config.yaml so V1 and V2 have distinct values.`,
    );
  }
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
      const notCompleted = notCompletedMigrations[i];
      try {
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

/**
 * Backfill MySQL mirror database from SQLite source data.
 * Runs on every startup when mirror is configured. Uses bulkCreate with
 * updateOnDuplicate for idempotent upsert behavior - rows that already exist
 * in MySQL get updated, missing rows get inserted.
 *
 * Uses dynamic imports to avoid circular dependency (models import from this file).
 */
const BACKFILL_BATCH_SIZE = 1000;

export const backfillMirrorV2 = async () => {
  if (!mirrorDBEnabledV2()) {
    return;
  }

  loggerV2.info('[v2]: Starting MySQL mirror backfill from SQLite...');

  try {
    // Dynamic import to avoid circular dependency
    // (model files import sequelizeV2/safeMirrorDbHandlerV2 from this file)
    const models = await import('../../models/v2/index.js');

    // All 22 source/mirror pairs - covers every model that has a mirror
    const mirrorPairs = [
      { source: models.ProgramV2, mirror: models.ProgramV2Mirror, name: 'program' },
      { source: models.MethodologyV2, mirror: models.MethodologyV2Mirror, name: 'methodology' },
      { source: models.ProjectV2, mirror: models.ProjectV2Mirror, name: 'project' },
      { source: models.ValidationV2, mirror: models.ValidationV2Mirror, name: 'validation' },
      { source: models.VerificationV2, mirror: models.VerificationV2Mirror, name: 'verification' },
      { source: models.IssuanceV2, mirror: models.IssuanceV2Mirror, name: 'issuance' },
      { source: models.UnitV2, mirror: models.UnitV2Mirror, name: 'unit' },
      { source: models.LocationV2, mirror: models.LocationV2Mirror, name: 'location' },
      { source: models.EstimationV2, mirror: models.EstimationV2Mirror, name: 'estimation' },
      { source: models.RatingV2, mirror: models.RatingV2Mirror, name: 'rating' },
      { source: models.CoBenefitV2, mirror: models.CoBenefitV2Mirror, name: 'co_benefit' },
      { source: models.ProjectMethodologyV2, mirror: models.ProjectMethodologyV2Mirror, name: 'project_methodology' },
      { source: models.StakeholderV2, mirror: models.StakeholderV2Mirror, name: 'stakeholder' },
      { source: models.StakeholderProjectV2, mirror: models.StakeholderProjectV2Mirror, name: 'stakeholder_projects' },
      { source: models.LabelV2, mirror: models.LabelV2Mirror, name: 'label' },
      { source: models.UnitLabelV2, mirror: models.UnitLabelV2Mirror, name: 'unit_label' },
      { source: models.AefT1SubmissionV2, mirror: models.AefT1SubmissionV2Mirror, name: 'aef_t1_submission' },
      { source: models.AefT5AuthorizedEntitiesV2, mirror: models.AefT5AuthorizedEntitiesV2Mirror, name: 'aef_t5_authorized_entities' },
      { source: models.AefT2AuthorizationsV2, mirror: models.AefT2AuthorizationsV2Mirror, name: 'aef_t2_authorizations' },
      { source: models.AefT3ActionsV2, mirror: models.AefT3ActionsV2Mirror, name: 'aef_t3_actions' },
      { source: models.AefT4HoldingsV2, mirror: models.AefT4HoldingsV2Mirror, name: 'aef_t4_holdings' },
      { source: models.AuditV2, mirror: models.AuditV2Mirror, name: 'audit' },
    ];

    let totalSynced = 0;

    for (const { source, mirror, name } of mirrorPairs) {
      try {
        // Verify mirror model is initialized (init may not have completed if mirror was just configured)
        if (!mirror.rawAttributes || Object.keys(mirror.rawAttributes).length === 0) {
          loggerV2.warn(`[v2]: Mirror backfill: ${name} - mirror model not initialized, skipping`);
          continue;
        }

        const count = await source.count();
        if (count === 0) {
          loggerV2.debug(`[v2]: Mirror backfill: ${name} - no records to sync`);
          continue;
        }

        // Determine which fields to update on duplicate key conflict.
        // Include all non-primary-key attributes so the mirror stays in sync
        // with any changes that occurred in the source.
        const updateFields = Object.keys(mirror.rawAttributes).filter(
          (attr) => !mirror.primaryKeyAttributes.includes(attr),
        );

        let synced = 0;
        for (let offset = 0; offset < count; offset += BACKFILL_BATCH_SIZE) {
          const rows = await source.findAll({
            raw: true,
            offset,
            limit: BACKFILL_BATCH_SIZE,
          });

          await mirror.bulkCreate(rows, {
            updateOnDuplicate: updateFields,
          });

          synced += rows.length;
        }

        loggerV2.info(`[v2]: Mirror backfill: ${name} - synced ${synced} records`);
        totalSynced += synced;
      } catch (error) {
        loggerV2.error(`[v2]: Mirror backfill error for ${name}: ${error.message}`);
        // Continue with next table - don't let one failure stop the entire backfill
      }
    }

    loggerV2.info(`[v2]: MySQL mirror backfill completed - ${totalSynced} total records synced`);
  } catch (error) {
    loggerV2.error('[v2]: MySQL mirror backfill failed:', error.message);
    // Don't throw - allow main database to continue operating
  }
};

// Mutex to prevent concurrent prepareV2Db calls
let prepareV2DbPromise = null;
let prepareV2DbCompleted = false;

export const prepareV2Db = async () => {
  // If already completed, verify critical tables still exist before returning
  if (prepareV2DbCompleted) {
    // Quick check: does the governance table exist?
    try {
      const tables = await sequelizeV2.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='governance'",
        { type: sequelizeV2.QueryTypes.SELECT }
      );
      if (tables && tables.length > 0) {
        // Tables exist, safe to return
        return;
      }
      // Tables missing! Reset the mutex and re-run
      loggerV2.warn('[v2]: Critical tables missing, re-running prepareV2Db()');
      prepareV2DbCompleted = false;
      prepareV2DbPromise = null;
    } catch (error) {
      // Database not accessible, reset and re-run
      loggerV2.warn('[v2]: Database check failed, re-running prepareV2Db():', error.message);
      prepareV2DbCompleted = false;
      prepareV2DbPromise = null;
    }
  }

  // If currently running, wait for it to complete
  if (prepareV2DbPromise) {
    return prepareV2DbPromise;
  }

  // Start the preparation and store the promise
  prepareV2DbPromise = (async () => {
    loggerV2.info('[v2]: prepareV2Db() starting...');

    // Check if MySQL mirror is configured
    const mirrorDbConfig = getConfigV2()?.MIRROR_DB;
    const isMysqlMirrorConfigured =
      mirrorDbConfig?.DB_HOST &&
      mirrorDbConfig?.DB_HOST !== '' &&
      mirrorDbConfig?.DB_NAME &&
      mirrorDbConfig?.DB_USERNAME &&
      mirrorDbConfig?.DB_PASSWORD;

    if (isMysqlMirrorConfigured) {
      // Validate that V1 and V2 mirror database names are different
      validateMirrorDbNames(getConfig(), getConfigV2());

      loggerV2.info('[v2]: MySQL mirror database configured, creating database and running migrations...');
      try {
        const connection = await mysql.createConnection({
          host: mirrorDbConfig.DB_HOST,
          port: 3306,
          user: mirrorDbConfig.DB_USERNAME,
          password: mirrorDbConfig.DB_PASSWORD,
        });

        const dbName = mirrorDbConfig.DB_NAME;
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        loggerV2.info(`[v2]: MySQL mirror database '${dbName}' created/verified`);
        await connection.end();

        // Run migrations on the MySQL mirror database
        await checkForV2Migrations(sequelizeV2Mirror);
        loggerV2.info('[v2]: MySQL mirror database migrations completed');
      } catch (error) {
        loggerV2.error('[v2]: Error setting up MySQL mirror database:', error.message);
        // Don't throw - allow main database to continue
      }
    } else {
      // No MySQL mirror configured - mirror operations will be no-ops
      loggerV2.info('[v2]: No MySQL mirror configured, mirror operations disabled');
    }

    loggerV2.info('[v2]: About to run main database migrations (sequelizeV2)...');
    await checkForV2Migrations(sequelizeV2);
    loggerV2.info('[v2]: Main database migrations completed');

    // Backfill mirror database from SQLite source data (idempotent upsert).
    // Runs after both mirror and main migrations are complete so all tables exist.
    if (isMysqlMirrorConfigured) {
      await backfillMirrorV2();
    }

    prepareV2DbCompleted = true;
    loggerV2.info('[v2]: prepareV2Db() completed successfully');
  })();

  try {
    await prepareV2DbPromise;
  } catch (error) {
    // Reset on error so it can be retried
    prepareV2DbPromise = null;
    prepareV2DbCompleted = false;
    loggerV2.error('[v2]: prepareV2Db() failed:', error);
    throw error;
  }
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
