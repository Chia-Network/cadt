/**
 * Shared state for organization UIDs across test runs
 * Stores organization UIDs in a JSON file so they persist between separate test executions
 * State file location: tests/v2/.organization-state.json (root of v2 tests directory)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '../../../.organization-state.json');

/**
 * Get organization state from file
 * @returns {{v2OrgUid: string|null, v1OrgUid: string|null, upgradedV2OrgUid: string|null}}
 */
export const getOrganizationState = () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`⚠️  Error reading organization state file: ${error.message}`);
  }

  return {
    v2OrgUid: null,
    v1OrgUid: null,
    upgradedV2OrgUid: null,
  };
};

/**
 * Save organization state to file
 * @param {{v2OrgUid: string|null, v1OrgUid: string|null, upgradedV2OrgUid: string|null}} state
 */
export const saveOrganizationState = (state) => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error(`❌ Error saving organization state file: ${error.message}`);
    throw error;
  }
};

/**
 * Clear organization state file
 */
export const clearOrganizationState = () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch (error) {
    console.warn(`⚠️  Error clearing organization state file: ${error.message}`);
  }
};

/**
 * Set V2 organization UID
 */
export const setV2OrgUid = (orgUid) => {
  const state = getOrganizationState();
  state.v2OrgUid = orgUid;
  saveOrganizationState(state);
};

/**
 * Set V1 organization UID
 */
export const setV1OrgUid = (orgUid) => {
  const state = getOrganizationState();
  state.v1OrgUid = orgUid;
  saveOrganizationState(state);
};

/**
 * Set upgraded V2 organization UID
 */
export const setUpgradedV2OrgUid = (orgUid) => {
  const state = getOrganizationState();
  state.upgradedV2OrgUid = orgUid;
  saveOrganizationState(state);
};
