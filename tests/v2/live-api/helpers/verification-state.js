/**
 * Unified shared state for cross-process test communication
 * Stores both verification records and created IDs in a JSON file
 * State file location: tests/v2/live-api/.test-state.json
 * 
 * Structure:
 * {
 *   verificationRecords: { type: { id: { operation, expectedData } } },
 *   createdIds: { type: [id1, id2, ...] }
 * }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '../.test-state.json');

/**
 * Get full state from file
 * @returns {object} Full state object
 */
const getFullState = () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`⚠️  Error reading test state file: ${error.message}`);
  }
  return { verificationRecords: {}, createdIds: {} };
};

/**
 * Save full state to file
 * @param {object} state - Full state object
 */
const saveFullState = (state) => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Error saving test state file: ${error.message}`);
    throw error;
  }
};

// ============================================
// VERIFICATION RECORDS (for batch verification)
// ============================================

/**
 * Get verification state from file
 * @returns {object} Verification records organized by type and id
 */
export const getVerificationState = () => {
  return getFullState().verificationRecords || {};
};

/**
 * Save verification state to file (legacy compatibility)
 * @param {object} state - Verification records organized by type and id
 */
export const saveVerificationState = (state) => {
  const fullState = getFullState();
  fullState.verificationRecords = state;
  saveFullState(fullState);
};

/**
 * Clear verification state (but keep createdIds)
 */
export const clearVerificationState = () => {
  const fullState = getFullState();
  fullState.verificationRecords = {};
  saveFullState(fullState);
};

/**
 * Add a verification record to the state file
 * @param {string} operation - 'POST', 'PUT', or 'DELETE'
 * @param {string} type - Resource type
 * @param {string|object} id - Record ID (string or composite key object)
 * @param {object} expectedData - Expected data for POST/PUT operations
 */
export const addVerificationRecord = (operation, type, id, expectedData = null) => {
  const fullState = getFullState();
  if (!fullState.verificationRecords) {
    fullState.verificationRecords = {};
  }
  if (!fullState.verificationRecords[type]) {
    fullState.verificationRecords[type] = {};
  }
  // Store composite keys as JSON strings, single keys as strings
  const idKey = typeof id === 'object' ? JSON.stringify(id) : id;
  fullState.verificationRecords[type][idKey] = {
    operation,
    expectedData,
  };
  saveFullState(fullState);
};

// ============================================
// CREATED IDS (for cross-process ID sharing)
// ============================================

/**
 * Get all created IDs from file
 * @returns {object} Created IDs organized by type: { type: [id1, id2, ...] }
 */
export const getCreatedIdsFromFile = () => {
  return getFullState().createdIds || {};
};

/**
 * Get created IDs for a specific type from file
 * @param {string} type - Resource type
 * @returns {Array} Array of IDs for that type
 */
export const getCreatedIdsByType = (type) => {
  const createdIds = getCreatedIdsFromFile();
  return createdIds[type] || [];
};

/**
 * Get the first created ID for a specific type from file
 * @param {string} type - Resource type
 * @returns {string|object|null} First ID or null if none exist
 */
export const getFirstCreatedIdFromFile = (type) => {
  const ids = getCreatedIdsByType(type);
  return ids.length > 0 ? ids[0] : null;
};

/**
 * Add a created ID to the file state
 * @param {string} type - Resource type
 * @param {string|object} id - The created ID
 */
export const addCreatedIdToFile = (type, id) => {
  const fullState = getFullState();
  if (!fullState.createdIds) {
    fullState.createdIds = {};
  }
  if (!fullState.createdIds[type]) {
    fullState.createdIds[type] = [];
  }
  fullState.createdIds[type].push(id);
  saveFullState(fullState);
};

/**
 * Clear created IDs (but keep verificationRecords)
 */
export const clearCreatedIdsFromFile = () => {
  const fullState = getFullState();
  fullState.createdIds = {};
  saveFullState(fullState);
};

/**
 * Clear ALL state (both verification records and created IDs)
 */
export const clearAllState = () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch (error) {
    console.warn(`⚠️  Error clearing test state file: ${error.message}`);
  }
};
