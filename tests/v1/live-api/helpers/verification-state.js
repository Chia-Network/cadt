/**
 * Shared state for batch verification records across test runs
 * Stores verification records in a JSON file so they persist between separate test executions
 * State file location: tests/v1/live-api/.verification-state.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '../.verification-state.json');

/**
 * Get verification state from file
 * @returns {object} Verification records organized by type and id
 */
export const getVerificationState = () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`⚠️  Error reading verification state file: ${error.message}`);
  }

  return {};
};

/**
 * Save verification state to file
 * @param {object} state - Verification records organized by type and id
 */
export const saveVerificationState = (state) => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Error saving verification state file: ${error.message}`);
    throw error;
  }
};

/**
 * Clear verification state file
 */
export const clearVerificationState = () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch (error) {
    console.warn(`⚠️  Error clearing verification state file: ${error.message}`);
  }
};

/**
 * Add a verification record to the state file
 * @param {string} operation - 'POST', 'PUT', or 'DELETE'
 * @param {string} type - Resource type
 * @param {string} id - Record ID
 * @param {object} expectedData - Expected data for POST/PUT operations
 */
export const addVerificationRecord = (operation, type, id, expectedData = null) => {
  const state = getVerificationState();
  if (!state[type]) {
    state[type] = {};
  }
  state[type][id] = {
    operation,
    expectedData,
  };
  saveVerificationState(state);
};

/**
 * Merge verification records into the state file
 * @param {object} records - Verification records to merge
 */
export const mergeVerificationRecords = (records) => {
  const state = getVerificationState();
  for (const [type, typeRecords] of Object.entries(records)) {
    if (!state[type]) {
      state[type] = {};
    }
    Object.assign(state[type], typeRecords);
  }
  saveVerificationState(state);
};
