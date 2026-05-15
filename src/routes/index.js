'use strict';

import { prepareDb } from '../database';
import { prepareV2Db } from '../database/v2';
import scheduler from '../tasks';
import { sequelize } from '../database';
import { sequelizeV2 } from '../database/v2';
import { logger } from '../config/logger.js';
import { pullPickListValues } from '../utils/data-loaders';
import { pullPickListValuesV2 } from '../utils/v2-data-loaders';
import { getConfig } from '../utils/config-loader';
import { getConfigV2 } from '../utils/config-loader';
import { getDiagnosticsResponse } from './diagnostics.js';

import app from '../middleware';

// Initialize databases and wait for migrations to complete
let migrationsReady = false;
let migrationsReadyPromise = null;

// Track when initial coin management is complete (needed for write operations)
let coinManagementReady = false;

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

  const configV1 = getConfig();
  const configV2 = getConfigV2();
  const enableV1 = configV1?.ENABLE !== false; // Default to true if not set
  const enableV2 = configV2?.ENABLE !== false; // Default to true if not set

  const initPromises = [];

  // Initialize V1 database if enabled
  if (enableV1) {
    initPromises.push(
      sequelize.authenticate().then(async () => {
        logger.info('[v1]: Connected to database');
        pullPickListValues();
        await prepareDb();
      }),
    );
  } else {
    logger.info('[v1]: V1 is disabled in config - skipping database initialization');
  }

  // Initialize V2 database if enabled
  if (enableV2) {
    initPromises.push(
      sequelizeV2.authenticate().then(async () => {
        logger.info('[v2]: Connected to V2 database');
        // Run migrations first to ensure tables exist before querying them
        await prepareV2Db();
        // Await pullPickListValuesV2 to ensure it completes before other operations
        // This prevents it from holding database locks during tests
        await pullPickListValuesV2();
      }),
    );
  } else {
    logger.info('[v2]: V2 is disabled in config - skipping database initialization');
  }

  migrationsReadyPromise = Promise.all(initPromises).then(() => {
    migrationsReady = true;
    logger.info('All database migrations completed');

    // Snapshot diagnostics into the log so operators always have a baseline,
    // even on READ_ONLY nodes that can't serve the /diagnostics endpoint.
    // Fire-and-forget: don't block scheduler start on RPC timeouts.
    getDiagnosticsResponse()
      .then((d) => logger.info(`Startup diagnostics: ${JSON.stringify(d)}`))
      .catch((e) => logger.warn(`Startup diagnostics collection failed: ${e.message}`));

    // Start scheduler after migrations complete
    // Note: scheduler.start is async - it runs coin management first before starting other tasks
    setTimeout(async () => {
      await scheduler.start(enableV1, enableV2);
      // Mark coin management as ready after scheduler.start completes
      // (scheduler.start awaits runCoinManagement before starting other tasks)
      coinManagementReady = true;
      logger.info('Initial coin management completed - write operations now available');
    }, 5000);
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
 * Check if initial coin management is complete
 * @returns {boolean} True if coin management has completed and write operations are available
 */
export const isCoinManagementReady = () => {
  return coinManagementReady;
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
