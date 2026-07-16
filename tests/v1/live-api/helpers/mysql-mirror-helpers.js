/**
 * MySQL Mirror Database Test Helpers (V1)
 *
 * Provides utilities for testing V1 MySQL mirror database functionality.
 * When the CADT config has a V1 MySQL mirror database enabled
 * (V1.MIRROR_DB in config.yaml), these helpers verify that data is
 * correctly mirrored to MySQL after POST/PUT/DELETE operations.
 *
 * Ported from tests/v2/live-api/helpers/mysql-mirror-helpers.js, adapted
 * for V1 table names (which use camelCase plurals like 'projectRatings',
 * 'coBenefits') and V1 primary keys (warehouseProjectId / warehouseUnitId).
 */

import mysql from 'mysql2/promise';
import * as yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { getChiaRoot } from '../../../../src/utils/chia-root.js';

let cachedConfig = null;
let connectionPool = null;

const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Read the V1 MySQL mirror database config from CADT config.yaml.
 * Returns null when V1.MIRROR_DB is not fully configured.
 */
export const getMirrorDbConfig = () => {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const chiaRoot = getChiaRoot();
  const configFile = path.resolve(`${chiaRoot}/cadt/config.yaml`);

  try {
    if (!fs.existsSync(configFile)) {
      console.log(
        `[${getTimestamp()}] MySQL Mirror (V1): Config file not found at ${configFile}`,
      );
      cachedConfig = false;
      return null;
    }

    const config = yaml.load(fs.readFileSync(configFile, 'utf8'));

    const mirrorDb = config?.V1?.MIRROR_DB;
    if (
      !mirrorDb?.DB_HOST ||
      !mirrorDb?.DB_USERNAME ||
      !mirrorDb?.DB_PASSWORD ||
      !mirrorDb?.DB_NAME
    ) {
      console.log(
        `[${getTimestamp()}] MySQL Mirror (V1): V1.MIRROR_DB not fully configured in config.yaml`,
      );
      cachedConfig = false;
      return null;
    }

    cachedConfig = {
      host: mirrorDb.DB_HOST,
      user: mirrorDb.DB_USERNAME,
      password: mirrorDb.DB_PASSWORD,
      database: mirrorDb.DB_NAME,
    };

    console.log(
      `[${getTimestamp()}] MySQL Mirror (V1): Found config - host=${cachedConfig.host}, database=${cachedConfig.database}`,
    );
    return cachedConfig;
  } catch (error) {
    console.error(
      `[${getTimestamp()}] MySQL Mirror (V1): Error reading config - ${error.message}`,
    );
    cachedConfig = false;
    return null;
  }
};

export const isMirrorDbEnabled = () => {
  const config = getMirrorDbConfig();
  return config !== null && config !== false;
};

export const getMirrorDbPool = async () => {
  const config = getMirrorDbConfig();
  if (!config) {
    return null;
  }

  if (connectionPool) {
    return connectionPool;
  }

  try {
    connectionPool = mysql.createPool({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });

    const connection = await connectionPool.getConnection();
    connection.release();
    console.log(
      `[${getTimestamp()}] MySQL Mirror (V1): Connection pool created successfully`,
    );
    return connectionPool;
  } catch (error) {
    console.error(
      `[${getTimestamp()}] MySQL Mirror (V1): Failed to create connection pool - ${error.message}`,
    );
    connectionPool = null;
    return null;
  }
};

export const closeMirrorDbPool = async () => {
  if (!connectionPool) return;
  const pool = connectionPool;
  // Drop the reference first so a throw in .end() doesn't leave us in a
  // state where a second call keeps invoking end() on a broken pool.
  connectionPool = null;
  try {
    await pool.end();
    console.log(
      `[${getTimestamp()}] MySQL Mirror (V1): Connection pool closed`,
    );
  } catch (error) {
    // Teardown is best-effort; swallow-and-log so test results are
    // not clobbered by connection-cleanup noise.
    console.warn(
      `[${getTimestamp()}] MySQL Mirror (V1): Error closing pool (ignored): ${error.message}`,
    );
  }
};

/**
 * Map of V1 test-tracking types to V1 MySQL mirror table names. V1 uses
 * camelCase plural table names (not snake_case) because the V1 mirror
 * migrations were authored without `underscored: true`.
 */
const TYPE_TO_TABLE = {
  project: 'projects',
  unit: 'units',
  issuance: 'issuances',
  label: 'labels',
  rating: 'projectRatings',
  projectRating: 'projectRatings',
  coBenefit: 'coBenefits',
  'co-benefit': 'coBenefits',
  location: 'projectLocations',
  projectLocation: 'projectLocations',
  estimation: 'estimations',
  relatedProject: 'relatedProjects',
  'related-project': 'relatedProjects',
  labelUnit: 'label_unit',
  'label-unit': 'label_unit',
  audit: 'audit',
  organization: 'organizations',
};

/**
 * Primary-key column names for each V1 mirror table. Only tables that V1
 * live-api tests currently track need explicit entries; others default to
 * 'id' which matches the Sequelize autoIncrement PK in the V1 mirror
 * migrations.
 */
const TYPE_TO_PRIMARY_KEY = {
  project: 'warehouseProjectId',
  unit: 'warehouseUnitId',
  organization: 'orgUid',
};

const DEFAULT_PRIMARY_KEY = 'id';

const getTable = (type) => TYPE_TO_TABLE[type];
const getPrimaryKey = (type) =>
  TYPE_TO_PRIMARY_KEY[type] || DEFAULT_PRIMARY_KEY;

export const getMirrorRecord = async (type, id) => {
  const pool = await getMirrorDbPool();
  if (!pool) {
    return null;
  }

  const tableName = getTable(type);
  const primaryKey = getPrimaryKey(type);

  if (!tableName) {
    console.error(
      `[${getTimestamp()}] MySQL Mirror (V1): Unknown type '${type}'`,
    );
    return null;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\` = ?`,
      [id],
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log(
        `[${getTimestamp()}] MySQL Mirror (V1): Table ${tableName} does not exist yet`,
      );
      return null;
    }
    console.error(
      `[${getTimestamp()}] MySQL Mirror (V1): Error querying ${tableName} - ${error.message}`,
    );
    return null;
  }
};

export const mirrorRecordExists = async (type, id) => {
  const record = await getMirrorRecord(type, id);
  return record !== null;
};

export const verifyMirrorRecord = async (type, id, expectedData = null) => {
  const result = { exists: false, dataMatches: true, errors: [] };

  const record = await getMirrorRecord(type, id);
  if (!record) {
    result.dataMatches = false;
    result.errors.push(`Record ${type}/${id} not found in MySQL mirror (V1)`);
    return result;
  }

  result.exists = true;

  if (!expectedData) {
    return result;
  }

  // V1 mirror columns are camelCase; expectedData keys are camelCase too,
  // so no translation is needed (unlike V2).
  for (const [key, expectedValue] of Object.entries(expectedData)) {
    const actualValue = record[key];

    if (expectedValue && typeof expectedValue === 'object') {
      continue;
    }

    if (
      expectedValue === null &&
      (actualValue === null || actualValue === undefined)
    ) {
      continue;
    }
    if (expectedValue === undefined) {
      continue;
    }

    if (expectedValue && actualValue) {
      const expectedIsDate = /^\d{4}-\d{2}-\d{2}/.test(String(expectedValue));
      if (expectedIsDate) {
        const expectedDatePart = String(expectedValue).substring(0, 10);
        let actualDatePart;
        if (actualValue instanceof Date) {
          actualDatePart = actualValue.toISOString().substring(0, 10);
        } else {
          actualDatePart = String(actualValue).substring(0, 10);
        }
        if (expectedDatePart === actualDatePart) {
          continue;
        }
        // Dates didn't match on the YYYY-MM-DD prefix. Record the mismatch
        // and skip the fallback comparisons: falling through to the
        // parseFloat branch below would compare '2024-01-01' and
        // '2024-06-15' as both equal to the year 2024 and silently
        // suppress the mismatch.
        result.dataMatches = false;
        result.errors.push(
          `Field '${key}' mismatch: expected '${expectedValue}', got '${actualValue}'`,
        );
        continue;
      }
    }

    if (typeof actualValue === 'string' && actualValue.startsWith('[')) {
      try {
        const parsedActual = JSON.parse(actualValue);
        if (Array.isArray(expectedValue) && Array.isArray(parsedActual)) {
          if (
            JSON.stringify(expectedValue.slice().sort()) ===
            JSON.stringify(parsedActual.slice().sort())
          ) {
            continue;
          }
        }
      } catch {
        /* not JSON */
      }
    }

    const expectedNum = parseFloat(expectedValue);
    const actualNum = parseFloat(actualValue);
    if (!isNaN(expectedNum) && !isNaN(actualNum)) {
      if (expectedNum === actualNum) {
        continue;
      }
    }

    if (String(actualValue) !== String(expectedValue)) {
      result.dataMatches = false;
      result.errors.push(
        `Field '${key}' mismatch: expected '${expectedValue}', got '${actualValue}'`,
      );
    }
  }

  return result;
};

export const verifyMirrorRecordDeleted = async (type, id) => {
  const result = { deleted: true, errors: [] };
  const record = await getMirrorRecord(type, id);
  if (record !== null) {
    result.deleted = false;
    result.errors.push(
      `Record ${type}/${id} still exists in MySQL mirror (V1) after DELETE`,
    );
  }
  return result;
};

export const verifyMirrorRecordsBatch = async (records) => {
  const result = { verified: 0, failed: 0, failures: [] };

  if (!isMirrorDbEnabled()) {
    console.log(
      `[${getTimestamp()}] MySQL Mirror (V1): Skipping batch verification - mirror DB not enabled`,
    );
    return result;
  }

  console.log(
    `[${getTimestamp()}] MySQL Mirror (V1): Verifying ${records.length} record(s) in mirror database...`,
  );

  for (const { type, id, operation, expectedData } of records) {
    try {
      if (operation === 'DELETE') {
        const deleteResult = await verifyMirrorRecordDeleted(type, id);
        if (deleteResult.deleted) {
          result.verified++;
          console.log(`  ✓ MySQL Mirror (V1): Verified DELETE ${type}/${id}`);
        } else {
          result.failed++;
          result.failures.push(...deleteResult.errors);
          console.error(
            `  ❌ MySQL Mirror (V1): ${deleteResult.errors.join(', ')}`,
          );
        }
      } else {
        const verifyResult = await verifyMirrorRecord(type, id, expectedData);
        if (verifyResult.exists && verifyResult.dataMatches) {
          result.verified++;
          console.log(
            `  ✓ MySQL Mirror (V1): Verified ${operation} ${type}/${id}`,
          );
        } else {
          result.failed++;
          result.failures.push(...verifyResult.errors);
          console.error(
            `  ❌ MySQL Mirror (V1): ${verifyResult.errors.join(', ')}`,
          );
        }
      }
    } catch (error) {
      result.failed++;
      result.failures.push(`${operation} ${type}/${id}: ${error.message}`);
      console.error(
        `  ❌ MySQL Mirror (V1): Error verifying ${type}/${id} - ${error.message}`,
      );
    }
  }

  console.log(
    `[${getTimestamp()}] MySQL Mirror (V1): Batch verification complete - ${result.verified} verified, ${result.failed} failed`,
  );
  return result;
};

export default {
  isMirrorDbEnabled,
  getMirrorDbConfig,
  getMirrorDbPool,
  closeMirrorDbPool,
  getMirrorRecord,
  mirrorRecordExists,
  verifyMirrorRecord,
  verifyMirrorRecordDeleted,
  verifyMirrorRecordsBatch,
};
