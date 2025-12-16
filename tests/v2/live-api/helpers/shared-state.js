/**
 * Shared state to track all created IDs across test files
 * Used for cleanup at the end of test run
 */

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
  if (!batchVerificationRecords[type]) {
    batchVerificationRecords[type] = {};
  }
  // Store composite keys as JSON strings, single keys as strings
  const idKey = typeof id === 'object' ? JSON.stringify(id) : id;
  batchVerificationRecords[type][idKey] = {
    operation,
    expectedData,
  };
};

/**
 * Get all records tracked for batch verification
 * @returns {object} Records organized by type and id
 */
export const getBatchVerificationRecords = () => {
  return batchVerificationRecords;
};

/**
 * Clear batch verification records (call after each phase)
 */
export const clearBatchVerificationRecords = () => {
  for (const key in batchVerificationRecords) {
    delete batchVerificationRecords[key];
  }
};

/**
 * Add a created ID to the shared state
 * @param {string} type - Resource type (e.g., 'methodology', 'project')
 * @param {string|object} id - The created ID (UUID string or composite key object)
 */
export const addCreatedId = (type, id) => {
  if (!createdIds[type]) {
    createdIds[type] = [];
  }
  createdIds[type].push(id);
};

/**
 * Get created IDs for a specific type
 * @param {string} type - Resource type (e.g., 'methodology', 'project')
 * @returns {Array<string|object>} Array of IDs for that type
 */
export const getCreatedIds = (type) => {
  return createdIds[type] || [];
};

/**
 * Get the first created ID for a specific type (useful for getting a single parent entity)
 * @param {string} type - Resource type
 * @returns {string|object|null} First ID or null if none exist
 */
export const getFirstCreatedId = (type) => {
  const ids = createdIds[type] || [];
  return ids.length > 0 ? ids[0] : null;
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
 */
export const clearAllCreatedIds = () => {
  for (const key in createdIds) {
    createdIds[key] = [];
  }
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
