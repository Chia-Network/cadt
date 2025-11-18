'use strict';

import { prepareDb } from '../database';
import { prepareV2Db } from '../database/v2';
import scheduler from '../tasks';
import { sequelize } from '../database';
import { sequelizeV2 } from '../database/v2';
import { logger } from '../config/logger.js';
import { pullPickListValues } from '../utils/data-loaders';
import { pullPickListValuesV2 } from '../utils/v2-data-loaders';

import app from '../middleware';

// Initialize databases and wait for migrations to complete
let migrationsReady = false;
let migrationsReadyPromise = null;

/**
 * Initialize databases and run migrations
 * Returns a promise that resolves when all migrations are complete
 */
export const initializeDatabases = async () => {
  if (migrationsReady) {
    return Promise.resolve();
  }

  if (migrationsReadyPromise) {
    return migrationsReadyPromise;
  }

  migrationsReadyPromise = Promise.all([
    // Initialize V1 database
    sequelize.authenticate().then(async () => {
      logger.info('Connected to database');
      pullPickListValues();
      await prepareDb();
    }),
    // Initialize V2 database
    sequelizeV2.authenticate().then(async () => {
      logger.info('Connected to V2 database');
      // Await pullPickListValuesV2 to ensure it completes before other operations
      // This prevents it from holding database locks during tests
      await pullPickListValuesV2();
      await prepareV2Db();
    }),
  ]).then(() => {
    migrationsReady = true;
    logger.info('All database migrations completed');

    // Start scheduler after migrations complete, but skip in test mode
    // In test mode, scheduler tasks can cause database locks that interfere with tests
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => {
        scheduler.start();
      }, 5000);
    } else {
      logger.debug('Skipping scheduler start in test mode');
    }
  }).catch((error) => {
    logger.error('Error initializing databases:', error);
    throw error;
  });

  return migrationsReadyPromise;
};

/**
 * Check if migrations are ready
 * @returns {boolean} True if migrations have completed
 */
export const areMigrationsReady = () => {
  return migrationsReady;
};

/**
 * Wait for migrations to complete (if not already ready)
 * @returns {Promise} Resolves when migrations are ready
 */
export const waitForMigrations = async () => {
  if (migrationsReady) {
    return Promise.resolve();
  }
  return initializeDatabases();
};

// Start initialization (but don't block exports)
initializeDatabases().catch((error) => {
  logger.error('Failed to initialize databases:', error);
});

export default app;
