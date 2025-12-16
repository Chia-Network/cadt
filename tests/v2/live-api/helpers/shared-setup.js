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

let setupComplete = false;
let sharedRequest = null;
let sharedHomeOrgId = null;

/**
 * Run shared setup once
 * This should be called before running any tests
 */
export async function runSharedSetup() {
  if (setupComplete) {
    return { request: sharedRequest, homeOrgId: sharedHomeOrgId };
  }

  try {
    // Step 1: Ensure home organization exists - FAIL FAST if it doesn't
    sharedRequest = await getLiveApiRequest();
    sharedHomeOrgId = await getHomeOrgId(sharedRequest);
    console.log(`✓ Home organization found: ${sharedHomeOrgId}`);

    // Step 2: Check database is empty - FAIL FAST if it's not
    await checkDatabaseEmpty(sharedRequest);

    setupComplete = true;
    return { request: sharedRequest, homeOrgId: sharedHomeOrgId };
  } catch (error) {
    console.error(`\n❌ Shared setup failed: ${error.message}`);
    console.error('Tests cannot proceed without a home organization and empty database.');
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
