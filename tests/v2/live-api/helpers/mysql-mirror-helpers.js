/**
 * MySQL Mirror Database Test Helpers
 *
 * Provides utilities for testing MySQL mirror database functionality.
 * When the CADT config has MySQL mirror database enabled (MIRROR_DB config section),
 * these helpers can be used to verify that data is correctly mirrored to MySQL.
 */

import mysql from 'mysql2/promise';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { getChiaRoot } from '../../../../src/utils/chia-root.js';

// Cache the config and connection
let cachedConfig = null;
let connectionPool = null;

/**
 * Format current timestamp for logging
 */
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
 * Read the MySQL mirror database config from CADT config.yaml
 * @returns {Object|null} Mirror DB config or null if not configured
 */
export const getMirrorDbConfig = () => {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const chiaRoot = getChiaRoot();
  const configFile = path.resolve(`${chiaRoot}/cadt/config.yaml`);

  try {
    if (!fs.existsSync(configFile)) {
      console.log(`[${getTimestamp()}] MySQL Mirror: Config file not found at ${configFile}`);
      cachedConfig = false;
      return null;
    }

    const config = yaml.load(fs.readFileSync(configFile, 'utf8'));

    // Check if MIRROR_DB is configured with all required fields
    // For V2 API tests, MIRROR_DB is under V2 section in the unified config
    const mirrorDb = config?.V2?.MIRROR_DB;
    if (!mirrorDb?.DB_HOST || !mirrorDb?.DB_USERNAME || !mirrorDb?.DB_PASSWORD || !mirrorDb?.DB_NAME) {
      console.log(`[${getTimestamp()}] MySQL Mirror: V2.MIRROR_DB not fully configured in config.yaml`);
      cachedConfig = false;
      return null;
    }

    cachedConfig = {
      host: mirrorDb.DB_HOST,
      user: mirrorDb.DB_USERNAME,
      password: mirrorDb.DB_PASSWORD,
      database: `${mirrorDb.DB_NAME}_v2`, // V2 uses {DB_NAME}_v2
    };

    console.log(`[${getTimestamp()}] MySQL Mirror: Found config - host=${cachedConfig.host}, database=${cachedConfig.database}`);
    return cachedConfig;
  } catch (error) {
    console.error(`[${getTimestamp()}] MySQL Mirror: Error reading config - ${error.message}`);
    cachedConfig = false;
    return null;
  }
};

/**
 * Check if MySQL mirror database is enabled in the config
 * @returns {boolean} True if mirror DB is configured
 */
export const isMirrorDbEnabled = () => {
  const config = getMirrorDbConfig();
  return config !== null && config !== false;
};

/**
 * Get a MySQL connection pool for the mirror database
 * Creates a pool if not already created
 * @returns {Promise<mysql.Pool|null>} MySQL connection pool or null if not configured
 */
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

    // Test the connection
    const connection = await connectionPool.getConnection();
    connection.release();
    console.log(`[${getTimestamp()}] MySQL Mirror: Connection pool created successfully`);
    return connectionPool;
  } catch (error) {
    console.error(`[${getTimestamp()}] MySQL Mirror: Failed to create connection pool - ${error.message}`);
    connectionPool = null;
    return null;
  }
};

/**
 * Close the MySQL connection pool
 */
export const closeMirrorDbPool = async () => {
  if (connectionPool) {
    await connectionPool.end();
    connectionPool = null;
    console.log(`[${getTimestamp()}] MySQL Mirror: Connection pool closed`);
  }
};

/**
 * Map of API endpoint types to MySQL table names
 * NOTE: These match the migration table names - the V2 mirror DB uses the same
 * table names as the main DB but in a separate database (cadt_mirror_test_v2)
 */
const TYPE_TO_TABLE = {
  organizations: 'organizations',
  methodology: 'methodology',
  program: 'program',
  project: 'project',
  validation: 'validation',
  verification: 'verification',
  issuance: 'issuance',
  unit: 'unit',
  location: 'location',
  estimation: 'estimation',
  rating: 'rating',
  'co-benefit': 'co_benefit',
  coBenefit: 'co_benefit',
  label: 'label',
  stakeholder: 'stakeholder',
  'stakeholder-projects': 'stakeholder_projects',
  stakeholderProjects: 'stakeholder_projects',
  'project-methodology': 'project_methodology',
  projectMethodology: 'project_methodology',
  'unit-label': 'unit_label',
  unitLabel: 'unit_label',
  'aef-t1-submission': 'aef_t1_submission',
  aefT1Submission: 'aef_t1_submission',
  'aef-t2-authorizations': 'aef_t2_authorizations',
  aefT2Authorizations: 'aef_t2_authorizations',
  'aef-t3-actions': 'aef_t3_actions',
  aefT3Actions: 'aef_t3_actions',
  'aef-t4-holdings': 'aef_t4_holdings',
  aefT4Holdings: 'aef_t4_holdings',
  'aef-t5-authorized-entities': 'aef_t5_authorized_entities',
  aefT5AuthorizedEntities: 'aef_t5_authorized_entities',
};

/**
 * Map of API endpoint types to primary key column names
 */
const TYPE_TO_PRIMARY_KEY = {
  organizations: 'org_uid',
  methodology: 'cad_trust_methodology_id',
  program: 'cad_trust_program_id',
  project: 'cad_trust_project_id',
  validation: 'cad_trust_validation_id',
  verification: 'cad_trust_verification_id',
  issuance: 'cad_trust_issuance_id',
  unit: 'cad_trust_unit_id',
  location: 'cad_trust_location_id',
  estimation: 'cad_trust_estimation_id',
  rating: 'cad_trust_rating_id',
  'co-benefit': 'cad_trust_co_benefit_id',
  coBenefit: 'cad_trust_co_benefit_id',
  label: 'cad_trust_label_id',
  stakeholder: 'cad_trust_stakeholder_id',
  'stakeholder-projects': 'cad_trust_stakeholder_project_id',
  stakeholderProjects: 'cad_trust_stakeholder_project_id',
  'project-methodology': 'cad_trust_project_methodology_id',
  projectMethodology: 'cad_trust_project_methodology_id',
  'unit-label': 'cad_trust_unit_label_id',
  unitLabel: 'cad_trust_unit_label_id',
  'aef-t1-submission': 'cad_trust_aef_t1_submission_id',
  aefT1Submission: 'cad_trust_aef_t1_submission_id',
  'aef-t2-authorizations': 'cad_trust_aef_t2_authorizations_id',
  aefT2Authorizations: 'cad_trust_aef_t2_authorizations_id',
  'aef-t3-actions': 'cad_trust_aef_t3_actions_id',
  aefT3Actions: 'cad_trust_aef_t3_actions_id',
  'aef-t4-holdings': 'cad_trust_aef_t4_holdings_id',
  aefT4Holdings: 'cad_trust_aef_t4_holdings_id',
  'aef-t5-authorized-entities': 'cad_trust_aef_t5_authorized_entities_id',
  aefT5AuthorizedEntities: 'cad_trust_aef_t5_authorized_entities_id',
};

/**
 * Convert camelCase to snake_case
 * @param {string} str - camelCase string
 * @returns {string} - snake_case string
 */
const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
};

/**
 * Get a record from the MySQL mirror database by type and ID
 * @param {string} type - Entity type (e.g., 'project', 'methodology')
 * @param {string} id - Record ID (UUID)
 * @returns {Promise<Object|null>} Record data or null if not found/error
 */
export const getMirrorRecord = async (type, id) => {
  const pool = await getMirrorDbPool();
  if (!pool) {
    return null;
  }

  const tableName = TYPE_TO_TABLE[type];
  const primaryKey = TYPE_TO_PRIMARY_KEY[type];

  if (!tableName || !primaryKey) {
    console.error(`[${getTimestamp()}] MySQL Mirror: Unknown type '${type}'`);
    return null;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM ${tableName} WHERE ${primaryKey} = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    // Table might not exist yet - this is OK
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log(`[${getTimestamp()}] MySQL Mirror: Table ${tableName} does not exist yet`);
      return null;
    }
    console.error(`[${getTimestamp()}] MySQL Mirror: Error querying ${tableName} - ${error.message}`);
    return null;
  }
};

/**
 * Check if a record exists in the MySQL mirror database
 * @param {string} type - Entity type
 * @param {string} id - Record ID
 * @returns {Promise<boolean>} True if record exists
 */
export const mirrorRecordExists = async (type, id) => {
  const record = await getMirrorRecord(type, id);
  return record !== null;
};

/**
 * Verify a record exists in MySQL mirror database and optionally validate data
 * @param {string} type - Entity type
 * @param {string} id - Record ID
 * @param {Object} expectedData - Optional expected data fields to validate (camelCase keys)
 * @returns {Promise<{exists: boolean, dataMatches: boolean, errors: string[]}>}
 */
export const verifyMirrorRecord = async (type, id, expectedData = null) => {
  const result = {
    exists: false,
    dataMatches: true,
    errors: [],
  };

  const record = await getMirrorRecord(type, id);
  if (!record) {
    result.dataMatches = false;
    result.errors.push(`Record ${type}/${id} not found in MySQL mirror`);
    return result;
  }

  result.exists = true;

  // If no expected data provided, just check existence
  if (!expectedData) {
    return result;
  }

  // Validate expected data fields
  for (const [camelKey, expectedValue] of Object.entries(expectedData)) {
    // Convert camelCase to snake_case for MySQL column names
    const snakeKey = camelToSnake(camelKey);
    const actualValue = record[snakeKey];

    // Skip validation for nested objects/arrays (stored differently)
    if (expectedValue && typeof expectedValue === 'object') {
      continue;
    }

    // Handle null/undefined equivalence
    if (expectedValue === null && (actualValue === null || actualValue === undefined)) {
      continue;
    }
    if (expectedValue === undefined) {
      continue;
    }

    // Handle date comparisons
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
      }
    }

    // Handle JSON array fields (stored as JSON strings in MySQL)
    if (typeof actualValue === 'string' && actualValue.startsWith('[')) {
      try {
        const parsedActual = JSON.parse(actualValue);
        if (Array.isArray(expectedValue) && Array.isArray(parsedActual)) {
          if (JSON.stringify(expectedValue.sort()) === JSON.stringify(parsedActual.sort())) {
            continue;
          }
        }
      } catch {
        // Not JSON, continue with normal comparison
      }
    }

    // Handle numeric comparisons (MySQL returns DECIMAL with full precision)
    // e.g., expected '1000' vs actual '1000.000000'
    const expectedNum = parseFloat(expectedValue);
    const actualNum = parseFloat(actualValue);
    if (!isNaN(expectedNum) && !isNaN(actualNum)) {
      // Compare numerically - both values are valid numbers
      if (expectedNum === actualNum) {
        continue;
      }
    }

    // String comparison
    if (String(actualValue) !== String(expectedValue)) {
      result.dataMatches = false;
      result.errors.push(
        `Field '${snakeKey}' mismatch: expected '${expectedValue}', got '${actualValue}'`
      );
    }
  }

  return result;
};

/**
 * Verify that a record does NOT exist in MySQL mirror database (for DELETE verification)
 * @param {string} type - Entity type
 * @param {string} id - Record ID
 * @returns {Promise<{deleted: boolean, errors: string[]}>}
 */
export const verifyMirrorRecordDeleted = async (type, id) => {
  const result = {
    deleted: true,
    errors: [],
  };

  const record = await getMirrorRecord(type, id);
  if (record !== null) {
    result.deleted = false;
    result.errors.push(`Record ${type}/${id} still exists in MySQL mirror after DELETE`);
  }

  return result;
};

/**
 * Verify multiple records in MySQL mirror database
 * Useful for batch verification after commits
 * @param {Array<{type: string, id: string, operation: string, expectedData?: Object}>} records
 * @returns {Promise<{verified: number, failed: number, failures: string[]}>}
 */
export const verifyMirrorRecordsBatch = async (records) => {
  const result = {
    verified: 0,
    failed: 0,
    failures: [],
  };

  if (!isMirrorDbEnabled()) {
    console.log(`[${getTimestamp()}] MySQL Mirror: Skipping batch verification - mirror DB not enabled`);
    return result;
  }

  console.log(`[${getTimestamp()}] MySQL Mirror: Verifying ${records.length} record(s) in mirror database...`);

  for (const { type, id, operation, expectedData } of records) {
    try {
      if (operation === 'DELETE') {
        const deleteResult = await verifyMirrorRecordDeleted(type, id);
        if (deleteResult.deleted) {
          result.verified++;
          console.log(`  ✓ MySQL Mirror: Verified DELETE ${type}/${id}`);
        } else {
          result.failed++;
          result.failures.push(...deleteResult.errors);
          console.error(`  ❌ MySQL Mirror: ${deleteResult.errors.join(', ')}`);
        }
      } else {
        // POST or PUT - verify record exists and data matches
        const verifyResult = await verifyMirrorRecord(type, id, expectedData);
        if (verifyResult.exists && verifyResult.dataMatches) {
          result.verified++;
          console.log(`  ✓ MySQL Mirror: Verified ${operation} ${type}/${id}`);
        } else {
          result.failed++;
          result.failures.push(...verifyResult.errors);
          console.error(`  ❌ MySQL Mirror: ${verifyResult.errors.join(', ')}`);
        }
      }
    } catch (error) {
      result.failed++;
      result.failures.push(`${operation} ${type}/${id}: ${error.message}`);
      console.error(`  ❌ MySQL Mirror: Error verifying ${type}/${id} - ${error.message}`);
    }
  }

  console.log(`[${getTimestamp()}] MySQL Mirror: Batch verification complete - ${result.verified} verified, ${result.failed} failed`);
  return result;
};

/**
 * Get all records from a mirror table
 * @param {string} type - Entity type
 * @returns {Promise<Array|null>} Array of records or null if error
 */
export const getAllMirrorRecords = async (type) => {
  const pool = await getMirrorDbPool();
  if (!pool) {
    return null;
  }

  const tableName = TYPE_TO_TABLE[type];
  if (!tableName) {
    console.error(`[${getTimestamp()}] MySQL Mirror: Unknown type '${type}'`);
    return null;
  }

  try {
    const [rows] = await pool.execute(`SELECT * FROM ${tableName}`);
    return rows;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log(`[${getTimestamp()}] MySQL Mirror: Table ${tableName} does not exist yet`);
      return [];
    }
    console.error(`[${getTimestamp()}] MySQL Mirror: Error querying ${tableName} - ${error.message}`);
    return null;
  }
};

/**
 * Get count of records in a mirror table
 * @param {string} type - Entity type
 * @returns {Promise<number|null>} Count or null if error
 */
export const getMirrorRecordCount = async (type) => {
  const pool = await getMirrorDbPool();
  if (!pool) {
    return null;
  }

  const tableName = TYPE_TO_TABLE[type];
  if (!tableName) {
    console.error(`[${getTimestamp()}] MySQL Mirror: Unknown type '${type}'`);
    return null;
  }

  try {
    const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    return rows[0].count;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    console.error(`[${getTimestamp()}] MySQL Mirror: Error counting ${tableName} - ${error.message}`);
    return null;
  }
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
  getAllMirrorRecords,
  getMirrorRecordCount,
};
