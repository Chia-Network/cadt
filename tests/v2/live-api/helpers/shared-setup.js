/**
 * Shared setup that runs once before all tests
 * Checks for home organization and validates database is empty
 * If home org doesn't exist, exits with failure
 */

import {
  getLiveApiRequest,
  getHomeOrgId,
  checkDatabaseEmpty,
} from './live-api-helpers.js';
import { clearAllState } from './verification-state.js';

let setupComplete = false;
let sharedRequest = null;
let sharedHomeOrgId = null;

/**
 * Run shared setup once
 * This should be called before running any tests
 * @param {boolean} skipEmptyCheck - If true, skip the empty database check (for PUT/DELETE phases)
 */
export async function runSharedSetup(skipEmptyCheck = false) {
  if (setupComplete) {
    return { request: sharedRequest, homeOrgId: sharedHomeOrgId };
  }

  try {
    // Step 1: Ensure home organization exists - FAIL FAST if it doesn't
    // Use V2 API version for health checks since we use V2 endpoints
    sharedRequest = await getLiveApiRequest({ apiVersion: 'v2' });
    sharedHomeOrgId = await getHomeOrgId(sharedRequest);
    console.log(`✓ Home organization found: ${sharedHomeOrgId}`);

    // Step 2: Check database is empty - FAIL FAST if it's not (skip for PUT/DELETE phases)
    if (!skipEmptyCheck) {
      await checkDatabaseEmpty(sharedRequest);
      // Clear shared state file for fresh test run
      clearAllState();
      console.log('✓ Cleared shared state file for fresh test run');
    } else {
      console.log('✓ Skipping empty database check (PUT/DELETE phase)');
    }

    setupComplete = true;
    return { request: sharedRequest, homeOrgId: sharedHomeOrgId };
  } catch (error) {
    console.error(`\n❌ Shared setup failed: ${error.message}`);
    if (skipEmptyCheck) {
      console.error('Tests cannot proceed without a home organization.');
    } else {
      console.error('Tests cannot proceed without a home organization and empty database.');
    }
    process.exit(1);
  }
}

/**
 * Get the shared request instance (setup must be run first)
 */
export function getSharedRequest() {
  if (!setupComplete) {
    throw new Error('Shared setup must be run before accessing shared request');
  }
  return sharedRequest;
}

/**
 * Get the shared home org ID (setup must be run first)
 */
export function getSharedHomeOrgId() {
  if (!setupComplete) {
    throw new Error('Shared setup must be run before accessing shared home org ID');
  }
  return sharedHomeOrgId;
}
