/**
 * Shared state to track all created IDs across test files
 * Used for cleanup at the end of test run
 */

import { addVerificationRecord as addVerificationRecordToFile, getVerificationState, clearVerificationState as clearVerificationStateFile } from './verification-state.js';

// Test execution mode: 'extended' (commit per resource) or 'short' (batch commits across all resources)
let testMode = process.env.TEST_MODE || 'extended';

/**
 * Set the test execution mode
 * @param {string} mode - 'extended' or 'short'
 */
export const setTestMode = (mode) => {
  if (mode !== 'extended' && mode !== 'short') {
    throw new Error(`Invalid test mode: ${mode}. Must be 'extended' or 'short'`);
  }
  testMode = mode;
};

/**
 * Get the current test execution mode
 * @returns {string} - 'extended' or 'short'
 */
export const getTestMode = () => testMode;

/**
 * Check if we should auto-commit (extended mode) or batch commits (short mode)
 * @returns {boolean} - true if auto-commit, false if batch mode
 */
export const shouldAutoCommit = () => testMode === 'extended';

const createdIds = {
  project: [],
  unit: [],
};

// Track records created/updated/deleted for batch verification
const batchVerificationRecords = {};

/**
 * Track a record for batch verification
 * @param {string} operation - 'POST', 'PUT', or 'DELETE'
 * @param {string} type - Resource type
 * @param {string} id - Record ID (warehouseProjectId or warehouseUnitId)
 * @param {object} expectedData - Expected data for POST/PUT operations
 */
export const trackBatchVerification = (operation, type, id, expectedData = null) => {
  // Store in memory (for same-process access)
  if (!batchVerificationRecords[type]) {
    batchVerificationRecords[type] = {};
  }
  batchVerificationRecords[type][id] = {
    operation,
    expectedData,
  };

  // Also persist to file (for cross-process access in short mode)
  if (testMode === 'short') {
    addVerificationRecordToFile(operation, type, id, expectedData);
  }
};

/**
 * Get all records tracked for batch verification
 * Always reads from file first (for cross-process access), then falls back to in-memory
 * @returns {object} Records organized by type and id
 */
export const getBatchVerificationRecords = () => {
  // Always try to read from file first (orchestration process doesn't have TEST_MODE set)
  const fileRecords = getVerificationState();

  // If file has records, use those (cross-process communication)
  if (Object.keys(fileRecords).length > 0) {
    return fileRecords;
  }

  // Fall back to in-memory records (same-process)
  return batchVerificationRecords;
};

/**
 * Clear batch verification records (call after each phase)
 */
export const clearBatchVerificationRecords = () => {
  // Clear in-memory records
  for (const key in batchVerificationRecords) {
    delete batchVerificationRecords[key];
  }
  // Always clear file (orchestration process doesn't have TEST_MODE set)
  clearVerificationStateFile();
};

/**
 * Add a created ID to the shared state
 * @param {string} type - Resource type (e.g., 'project', 'unit')
 * @param {string} id - The created ID (warehouseProjectId or warehouseUnitId)
 */
export const addCreatedId = (type, id) => {
  if (!createdIds[type]) {
    createdIds[type] = [];
  }
  createdIds[type].push(id);
};

/**
 * Get created IDs for a specific type
 * @param {string} type - Resource type (e.g., 'project', 'unit')
 * @returns {Array<string>} Array of IDs for that type
 */
export const getCreatedIds = (type) => {
  return createdIds[type] || [];
};

/**
 * Get the first created ID for a specific type
 * @param {string} type - Resource type
 * @returns {string|null} First ID or null if none exist
 */
export const getFirstCreatedId = (type) => {
  const ids = createdIds[type] || [];
  return ids.length > 0 ? ids[0] : null;
};

/**
 * Get the first record ID from the database for a specific type
 * @param {Object} request - supertest request instance
 * @param {string} type - Resource type (e.g., 'project', 'unit')
 * @returns {Promise<string|null>} First record ID or null if none exist
 */
export const getFirstRecordIdFromDatabase = async (request, type) => {
  try {
    const endpoint = type === 'project' ? '/v1/projects?page=1&limit=1' : '/v1/units?page=1&limit=1';
    const response = await request.get(endpoint);
    const data = response.body?.data || [];

    if (response.status === 200 && Array.isArray(data) && data.length > 0) {
      const firstRecord = data[0];
      const idField = type === 'project' ? 'warehouseProjectId' : 'warehouseUnitId';
      return firstRecord[idField] || null;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Get all record IDs from the database for a specific type
 * @param {Object} request - supertest request instance
 * @param {string} type - Resource type (e.g., 'project', 'unit')
 * @returns {Promise<string[]>} Array of record IDs
 */
export const getAllRecordIdsFromDatabase = async (request, type) => {
  try {
    const endpoint = type === 'project' ? '/v1/projects?page=1&limit=1000' : '/v1/units?page=1&limit=1000';
    const response = await request.get(endpoint);
    const data = response.body?.data || [];

    if (response.status === 200 && Array.isArray(data) && data.length > 0) {
      const idField = type === 'project' ? 'warehouseProjectId' : 'warehouseUnitId';
      return data
        .map(record => record[idField])
        .filter(id => id != null);
    }
    return [];
  } catch (error) {
    return [];
  }
};

/**
 * Get all created IDs in reverse dependency order for cleanup
 * @returns {Array<{type: string, id: string}>}
 */
export const getAllCreatedIds = () => {
  const all = [];
  // Delete in reverse dependency order: units first, then projects
  const deleteOrder = ['unit', 'project'];

  for (const type of deleteOrder) {
    if (createdIds[type] && createdIds[type].length > 0) {
      for (const id of createdIds[type]) {
        all.push({ type, id });
      }
    }
  }

  return all;
};

/**
 * Clear all tracked IDs (useful for test cleanup)
 */
export const clearAllCreatedIds = () => {
  for (const key in createdIds) {
    createdIds[key] = [];
  }
};

// Track endpoints being tested for logging
const testedEndpoints = {
  POST: [],
  PUT: [],
  DELETE: [],
};

/**
 * Track an endpoint being tested
 * @param {string} method - HTTP method (POST, PUT, DELETE)
 * @param {string} endpoint - Endpoint path (e.g., '/v1/projects')
 */
export const trackTestEndpoint = (method, endpoint) => {
  if (testedEndpoints[method]) {
    testedEndpoints[method].push(endpoint);
  }
};

/**
 * Get all tracked endpoints for a method
 * @param {string} method - HTTP method (POST, PUT, DELETE)
 * @returns {Array<string>} Array of endpoint paths
 */
export const getTestedEndpoints = (method) => {
  return testedEndpoints[method] || [];
};

/**
 * Clear tracked endpoints (call between phases)
 */
export const clearTestedEndpoints = () => {
  testedEndpoints.POST = [];
  testedEndpoints.PUT = [];
  testedEndpoints.DELETE = [];
};
