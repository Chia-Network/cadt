/**
 * Shared state to track all created IDs across test files
 * Uses both in-memory state (for same-process access) and file-based state (for cross-process access)
 * Used for cleanup at the end of test run
 */

import { 
  addVerificationRecord as addVerificationRecordToFile, 
  getVerificationState, 
  clearVerificationState as clearVerificationStateFile,
  getCreatedIdsByType,
  getFirstCreatedIdFromFile,
  addCreatedIdToFile,
  clearCreatedIdsFromFile,
  clearAllState,
} from './verification-state.js';

// Test execution mode: 'extended' (commit per resource) or 'short' (batch commits across all resources)
// Defaults to 'extended' for backward compatibility
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
  methodology: [],
  program: [],
  project: [],
  validation: [],
  verification: [],
  issuance: [],
  unit: [],
  location: [],
  estimation: [],
  rating: [],
  'co-benefit': [],
  label: [],
  stakeholder: [],
  'project-methodology': [],
  'stakeholder-projects': [],
  'unit-label': [],
  'aef-t1-submission': [],
  'aef-t2-authorizations': [],
  'aef-t3-actions': [],
  'aef-t4-holdings': [],
  'aef-t5-authorized-entities': [],
};

// Track records created/updated/deleted for batch verification
// Structure: { type: { id: { operation: 'POST'|'PUT'|'DELETE', expectedData?: object } } }
const batchVerificationRecords = {};

/**
 * Track a record for batch verification
 * @param {string} operation - 'POST', 'PUT', or 'DELETE'
 * @param {string} type - Resource type
 * @param {string|object} id - Record ID (string for single key, object for composite key)
 * @param {object} expectedData - Expected data for POST/PUT operations
 */
export const trackBatchVerification = (operation, type, id, expectedData = null) => {
  // Store composite keys as JSON strings, single keys as strings
  const idKey = typeof id === 'object' ? JSON.stringify(id) : id;

  // Store in memory (for same-process access)
  if (!batchVerificationRecords[type]) {
    batchVerificationRecords[type] = {};
  }
  batchVerificationRecords[type][idKey] = {
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
 * Persists to both in-memory state (same-process) and file (cross-process)
 * @param {string} type - Resource type (e.g., 'methodology', 'project')
 * @param {string|object} id - The created ID (UUID string or composite key object)
 */
export const addCreatedId = (type, id) => {
  // Add to in-memory state
  if (!createdIds[type]) {
    createdIds[type] = [];
  }
  createdIds[type].push(id);
  
  // Also persist to file for cross-process access
  addCreatedIdToFile(type, id);
};

/**
 * Get created IDs for a specific type
 * Checks in-memory state first, falls back to file for cross-process access
 * @param {string} type - Resource type (e.g., 'methodology', 'project')
 * @returns {Array<string|object>} Array of IDs for that type
 */
export const getCreatedIds = (type) => {
  // Check in-memory first (same process)
  const memoryIds = createdIds[type] || [];
  if (memoryIds.length > 0) {
    return memoryIds;
  }
  // Fall back to file (cross-process)
  return getCreatedIdsByType(type);
};

/**
 * Get the first created ID for a specific type (useful for getting a single parent entity)
 * Checks in-memory state first, falls back to file for cross-process access
 * @param {string} type - Resource type
 * @returns {string|object|null} First ID or null if none exist
 */
export const getFirstCreatedId = (type) => {
  // Check in-memory first (same process)
  const memoryIds = createdIds[type] || [];
  if (memoryIds.length > 0) {
    return memoryIds[0];
  }
  // Fall back to file (cross-process)
  return getFirstCreatedIdFromFile(type);
};

/**
 * Mapping of resource types to their primary key field names
 */
const PRIMARY_KEY_FIELDS = {
  'methodology': 'cadTrustMethodologyId',
  'program': 'cadTrustProgramId',
  'project': 'cadTrustProjectId',
  'validation': 'cadTrustValidationId',
  'verification': 'cadTrustVerificationId',
  'issuance': 'cadTrustIssuanceId',
  'unit': 'cadTrustUnitId',
  'location': 'cadTrustLocationId',
  'estimation': 'cadTrustEstimationId',
  'rating': 'cadTrustRatingId',
  'co-benefit': 'cadTrustCoBenefitId',
  'label': 'cadTrustLabelId',
  'stakeholder': 'cadTrustStakeholderId',
  'project-methodology': 'cadTrustProjectMethodologyId',
  'stakeholder-projects': 'cadTrustStakeholderProjectId',
  'unit-label': 'cadTrustUnitLabelId',
  'aef-t1-submission': 'cadTrustAefT1SubmissionId',
  'aef-t2-authorizations': 'cadTrustAefT2AuthorizationsId',
  'aef-t3-actions': 'cadTrustAefT3ActionsId',
  'aef-t4-holdings': 'cadTrustAefT4HoldingsId',
  'aef-t5-authorized-entities': 'cadTrustAefT5AuthorizedEntitiesId',
};

/**
 * Get the first record ID from the database for a specific type
 * This is useful for PUT/DELETE tests that run in separate processes
 * @param {Object} request - supertest request instance
 * @param {string} type - Resource type (e.g., 'methodology', 'project')
 * @returns {Promise<string|null>} First record ID or null if none exist
 */
export const getFirstRecordIdFromDatabase = async (request, type) => {
  try {
    const response = await request.get(`/v2/${type}`);
    const data = Array.isArray(response.body)
      ? response.body
      : (response.body?.data || []);

    if (response.status === 200 && Array.isArray(data) && data.length > 0) {
      const firstRecord = data[0];
      const idField = PRIMARY_KEY_FIELDS[type];
      if (idField && firstRecord[idField]) {
        return firstRecord[idField];
      }
      // Fallback: try to find ID field
      const foundIdField = Object.keys(firstRecord).find(key =>
        key.toLowerCase().includes('id') &&
        (key.toLowerCase().includes(type.toLowerCase()) || key === 'id')
      );
      return foundIdField ? firstRecord[foundIdField] : null;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Get all record IDs from the database for a specific type
 * This is useful for DELETE tests that run in separate processes
 * @param {Object} request - supertest request instance
 * @param {string} type - Resource type (e.g., 'methodology', 'project')
 * @returns {Promise<string[]>} Array of record IDs
 */
export const getAllRecordIdsFromDatabase = async (request, type) => {
  try {
    const response = await request.get(`/v2/${type}`).query({ page: 1, limit: 1000 });
    const data = response.body?.data || [];

    if (response.status === 200 && Array.isArray(data) && data.length > 0) {
      const idField = PRIMARY_KEY_FIELDS[type];
      if (idField) {
        return data
          .map(record => record[idField])
          .filter(id => id != null);
      }
      // Fallback: try to find ID field
      const foundIdField = Object.keys(data[0] || {}).find(key =>
        key.toLowerCase().includes('id') &&
        (key.toLowerCase().includes(type.toLowerCase()) || key === 'id')
      );
      if (foundIdField) {
        return data
          .map(record => record[foundIdField])
          .filter(id => id != null);
      }
    }
    return [];
  } catch (error) {
    return [];
  }
};

/**
 * Get all created IDs in reverse dependency order for cleanup
 * @returns {Array<{type: string, id: string|object}>}
 */
export const getAllCreatedIds = () => {
  const all = [];
  // Delete in reverse dependency order
  const deleteOrder = [
    'unit-label',
    'stakeholder-projects',
    'project-methodology',
    'unit',
    'issuance',
    'verification',
    'validation',
    'aef-t4-holdings',
    'aef-t3-actions',
    'aef-t2-authorizations',
    'aef-t5-authorized-entities',
    'aef-t1-submission',
    'co-benefit',
    'estimation',
    'rating',
    'label',
    'stakeholder',
    'project',
    'program',
    'methodology',
    'location',
  ];

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
 * Clears both in-memory and file state
 */
export const clearAllCreatedIds = () => {
  // Clear in-memory
  for (const key in createdIds) {
    createdIds[key] = [];
  }
  // Clear file
  clearCreatedIdsFromFile();
};

/**
 * Clear ALL shared state (IDs, verification records, tested endpoints)
 * Call this at the beginning of a fresh test run
 */
export const clearAllSharedState = () => {
  // Clear in-memory
  for (const key in createdIds) {
    createdIds[key] = [];
  }
  for (const key in batchVerificationRecords) {
    delete batchVerificationRecords[key];
  }
  testedEndpoints.POST = [];
  testedEndpoints.PUT = [];
  testedEndpoints.DELETE = [];
  // Clear file (removes entire file)
  clearAllState();
};

// Track endpoints being tested for logging
// Structure: { POST: ['/v2/co-benefit', '/v2/co-benefit', ...], PUT: [...], DELETE: [...] }
const testedEndpoints = {
  POST: [],
  PUT: [],
  DELETE: [],
};

/**
 * Track an endpoint being tested
 * @param {string} method - HTTP method (POST, PUT, DELETE)
 * @param {string} endpoint - Endpoint path (e.g., '/v2/co-benefit')
 */
export const trackTestEndpoint = (method, endpoint) => {
  if (testedEndpoints[method]) {
    testedEndpoints[method].push(endpoint);
  }
};

/**
 * Get all tracked endpoints for a method
 * @param {string} method - HTTP method (POST, PUT, DELETE)
 * @returns {Array<string>} Array of endpoint paths (may contain duplicates)
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
