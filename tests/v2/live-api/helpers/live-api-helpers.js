import supertest from 'supertest';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { getChiaRoot } from '../../../../src/utils/chia-root.js';
import { shouldAutoCommit, trackTestEndpoint } from './shared-state.js';

/**
 * Format current timestamp as YYYY-MM-DD HH:mm:ss
 * @returns {string} - Formatted timestamp
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

// Cache config to avoid reading file multiple times
let cachedConfig = null;

/**
 * Read production config from ~/.chia/mainnet/cadt/config.yaml
 * This reads the actual production config, not test config
 * Config is cached after first read
 */
export const getLiveApiConfig = () => {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  const chiaRoot = getChiaRoot();
  const configFile = path.resolve(`${chiaRoot}/cadt/config.yaml`);

  console.log(`Reading production config from: ${configFile}`);

  let config;
  try {
    if (fs.existsSync(configFile)) {
      const yml = yaml.load(fs.readFileSync(configFile, 'utf8'));
      config = yml;
      console.log(`✓ Config file loaded successfully`);
    } else {
      // Fallback to defaults if config doesn't exist
      console.warn(`⚠️  Config file not found at ${configFile}, using defaults`);
      config = { APP: { CW_PORT: 31310 } };
    }
  } catch (error) {
    console.error(`❌ Error reading config file: ${error.message}`);
    config = { APP: { CW_PORT: 31310 } };
  }

  const port = config?.APP?.CW_PORT || 31310;
  // Allow TEST_API_HOST env var to override, default to localhost for local dev
  // CI can set TEST_API_HOST=127.0.0.1 if needed for container environments
  const host = process.env.TEST_API_HOST || 'localhost';
  const baseUrl = `http://${host}:${port}`;

  console.log(`Using API endpoint: ${baseUrl} (host: ${host}, port: ${port})`);

  cachedConfig = { baseUrl, port, config };
  return cachedConfig;
};

/**
 * Create supertest instance pointing to localhost API
 */
export const createLiveApiRequest = () => {
  const { baseUrl } = getLiveApiConfig();
  return supertest(baseUrl);
};

/**
 * Check if server is running by hitting health endpoint
 * Retries with timeout if server not ready
 * Provides detailed diagnostics on failure
 *
 * @param {Object} request - supertest request instance
 * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 30000)
 * @param {Object} options - Options
 * @param {string} options.apiVersion - API version to check: 'v1', 'v2', or 'any' (default: 'any')
 */
export const waitForServer = async (request, maxWaitTime = 30000, options = {}) => {
  const { apiVersion = 'any' } = options;
  const startTime = Date.now();
  const interval = 2000; // Check every 2 seconds

  // Track diagnostic info for better error reporting
  let lastV2Response = null;
  let lastV1Response = null;
  let lastRootHealthResponse = null;
  let lastError = null;
  let connectionRefusedCount = 0;

  console.log(`[${getTimestamp()}] Checking server health (timeout: ${maxWaitTime}ms, apiVersion: ${apiVersion})...`);

  while (Date.now() - startTime < maxWaitTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    // For V2 or 'any', try V2 health endpoint
    if (apiVersion === 'v2' || apiVersion === 'any') {
      try {
        const response = await request.get('/v2/health');
        lastV2Response = {
          status: response.status,
          body: response.body,
          timestamp: getTimestamp(),
        };

        if (response.status === 200) {
          console.log(`[${getTimestamp()}] ✓ Server ready (V2 health check passed)`);
          return true;
        }

        // Log non-200 responses to help diagnose issues
        if (response.status === 403) {
          if (apiVersion === 'v2') {
            console.log(`[${getTimestamp()}] V2 health returned 403 - V2 API is disabled`);
          }
          // For 'any', silently continue to try other endpoints
        } else if (response.status === 400) {
          console.log(`[${getTimestamp()}] V2 health returned 400: ${response.body?.message || response.body?.error || 'Unknown error'}`);
        }
      } catch (error) {
        lastError = error;
        const isConnectionRefused = error.code === 'ECONNREFUSED' ||
          error.message?.includes('ECONNREFUSED') ||
          error.message?.includes('connect ECONNREFUSED');

        if (isConnectionRefused) {
          connectionRefusedCount++;
          if (connectionRefusedCount <= 3 || connectionRefusedCount % 5 === 0) {
            console.log(`[${getTimestamp()}] Connection refused (${connectionRefusedCount}x) - server may not be running yet (${elapsed}s elapsed)`);
          }
        }
      }
    }

    // For V1 or 'any', try V1 health endpoint
    if (apiVersion === 'v1' || apiVersion === 'any') {
      try {
        const response = await request.get('/v1/health');
        lastV1Response = {
          status: response.status,
          body: response.body,
          timestamp: getTimestamp(),
        };

        if (response.status === 200) {
          console.log(`[${getTimestamp()}] ✓ Server ready (V1 health check passed)`);
          return true;
        }

        if (response.status === 403) {
          if (apiVersion === 'v1') {
            console.log(`[${getTimestamp()}] V1 health returned 403 - V1 API is disabled`);
          }
        } else if (response.status === 400) {
          console.log(`[${getTimestamp()}] V1 health returned 400: ${response.body?.message || response.body?.error || 'Unknown error'}`);
        }
      } catch (error) {
        // V1 also failed - continue
        if (apiVersion === 'v1') {
          lastError = error;
          const isConnectionRefused = error.code === 'ECONNREFUSED' ||
            error.message?.includes('ECONNREFUSED') ||
            error.message?.includes('connect ECONNREFUSED');

          if (isConnectionRefused) {
            connectionRefusedCount++;
            if (connectionRefusedCount <= 3 || connectionRefusedCount % 5 === 0) {
              console.log(`[${getTimestamp()}] Connection refused (${connectionRefusedCount}x) - server may not be running yet (${elapsed}s elapsed)`);
            }
          }
        }
      }
    }

    // Try root health endpoint as last resort (for 'any' mode)
    if (apiVersion === 'any') {
      try {
        const response = await request.get('/health');
        lastRootHealthResponse = {
          status: response.status,
          body: response.body,
          timestamp: getTimestamp(),
        };

        if (response.status === 200) {
          // Root health works - server is running
          // For 'any' mode, this means server is up but specific APIs might be disabled
          console.log(`[${getTimestamp()}] ✓ Server ready (root health check passed)`);
          return true;
        }
      } catch (error) {
        // Root health also failed
      }
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Build detailed error message with diagnostics
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const diagnostics = buildServerDiagnostics(lastV2Response, lastV1Response, lastRootHealthResponse, lastError, connectionRefusedCount);

  throw new Error(
    `Server not ready after ${maxWaitTime}ms (${elapsed}s)\n\n` +
    `=== SERVER HEALTH DIAGNOSTICS ===\n${diagnostics}\n` +
    `=================================\n\n` +
    `Troubleshooting tips:\n` +
    `- If connection refused: Check that CADT server is running (pm2 status, pm2 logs cadt)\n` +
    `- If V1 403: Check config.yaml has V1.ENABLE = true\n` +
    `- If V2 403: Check config.yaml has V2.ENABLE = true\n` +
    `- If 400 "Chia Exception": Check Chia services are running and synced (chia show -s, chia wallet show)\n` +
    `- If wallet syncing: Wait for wallet to sync before running tests\n` +
    `- If datalayer unavailable: Ensure data_layer service is running (chia start data)`
  );
};

/**
 * Build diagnostic information from health check responses
 */
const buildServerDiagnostics = (v2Response, v1Response, rootResponse, lastError, connectionRefusedCount) => {
  const lines = [];

  // Connection status
  if (connectionRefusedCount > 0) {
    lines.push(`Connection Status: REFUSED (${connectionRefusedCount} times)`);
    lines.push(`  → Server may not be running or wrong port`);
  } else {
    lines.push(`Connection Status: Server reachable`);
  }

  // V2 Health
  lines.push('');
  lines.push('V2 Health (/v2/health):');
  if (v2Response) {
    lines.push(`  Status: ${v2Response.status}`);
    if (v2Response.status === 403) {
      lines.push(`  → V2 API is disabled in config`);
      lines.push(`  → Set V2.ENABLE = true in config.yaml`);
    } else if (v2Response.status === 400) {
      const msg = v2Response.body?.message || v2Response.body?.error || 'Unknown';
      lines.push(`  Error: ${msg}`);
      if (msg.includes('Chia Exception')) {
        const detail = v2Response.body?.error || '';
        lines.push(`  Detail: ${detail}`);
        if (detail.includes('DataLayer') || detail.includes('datalayer')) {
          lines.push(`  → DataLayer service may not be running`);
        }
        if (detail.includes('wallet') || detail.includes('syncing')) {
          lines.push(`  → Wallet may still be syncing`);
        }
      }
    } else {
      lines.push(`  Response: ${JSON.stringify(v2Response.body)}`);
    }
  } else {
    lines.push(`  No response received`);
  }

  // V1 API status (checked via /v1/organizations since V1 has no health endpoint)
  lines.push('');
  lines.push('V1 API (/v1/organizations):');
  if (v1Response) {
    lines.push(`  Status: ${v1Response.status}`);
    if (v1Response.status === 403) {
      lines.push(`  → V1 API is disabled in config`);
      lines.push(`  → Set V1.ENABLE = true in config.yaml`);
    } else if (v1Response.status === 400) {
      const msg = v1Response.body?.message || v1Response.body?.error || 'Unknown';
      lines.push(`  Error: ${msg}`);
      lines.push(`  → Chia services may not be ready`);
    } else if (v1Response.status === 200) {
      lines.push(`  ✓ V1 API is enabled and responding`);
    } else if (v1Response.status === 404) {
      lines.push(`  → V1 endpoint not found (unexpected)`);
    }
  } else {
    lines.push(`  No response received`);
  }

  // Root Health
  lines.push('');
  lines.push('Root Health (/health):');
  if (rootResponse) {
    lines.push(`  Status: ${rootResponse.status}`);
    if (rootResponse.status === 200) {
      lines.push(`  ✓ Server is running but middleware blocking V1/V2`);
    }
  } else {
    lines.push(`  No response received`);
  }

  // Last error
  if (lastError) {
    lines.push('');
    lines.push('Last Error:');
    lines.push(`  ${lastError.message || lastError}`);
    if (lastError.code) {
      lines.push(`  Code: ${lastError.code}`);
    }
  }

  return lines.join('\n');
};

/**
 * Get home organization ID (assumes it exists)
 * Response format is an object keyed by org_uid, not an array
 */
export const getHomeOrgId = async (request) => {
  const response = await request
    .get('/v2/organizations')
    .expect(200);

  // Response is an object keyed by org_uid: { "org_uid": { org data }, ... }
  if (!response.body || typeof response.body !== 'object' || Object.keys(response.body).length === 0) {
    throw new Error('No organizations found. Please ensure a home organization exists.');
  }

  // Convert object to array of orgs
  const orgs = Object.values(response.body);

  // Find home org (check is_home flag)
  const homeOrg = orgs.find(org => org.is_home === true || org.isHome === true);

  if (!homeOrg) {
    throw new Error('No home organization found. Please ensure a home organization exists.');
  }

  // Handle both snake_case and camelCase field names
  const orgUid = homeOrg.org_uid || homeOrg.orgUid;

  if (!orgUid) {
    throw new Error('Home organization found but missing org_uid');
  }

  return orgUid;
};

/**
 * Check if database is empty (fails if not empty)
 * Checks all data tables to see if they have records
 * @throws {Error} If database is not empty
 */
export const checkDatabaseEmpty = async (request) => {
  const dataTables = [
    'methodology',
    'program',
    'project',
    'validation',
    'verification',
    'issuance',
    'unit',
    'location',
    'estimation',
    'rating',
    'co-benefit',
    'label',
    'stakeholder',
    'stakeholder-projects',
    'project-methodology',
    'unit-label',
    'aef-t1-submission',
    'aef-t2-authorizations',
    'aef-t3-actions',
    'aef-t4-holdings',
    'aef-t5-authorized-entities',
  ];

  const nonEmptyTables = [];

  for (const table of dataTables) {
    try {
      const response = await request.get(`/v2/${table}`);
      // Response might be array or object with data property
      const data = Array.isArray(response.body)
        ? response.body
        : (response.body?.data || []);

      if (response.status === 200 && Array.isArray(data) && data.length > 0) {
        nonEmptyTables.push({ table, count: data.length });
      }
    } catch (error) {
      // Table might not exist or endpoint might not be available, skip
    }
  }

  if (nonEmptyTables.length > 0) {
    const errorMsg = `Database is not empty. Found data in:\n${nonEmptyTables.map(({ table, count }) => `   - ${table}: ${count} record(s)`).join('\n')}\nPlease clear the database before running tests.`;
    throw new Error(errorMsg);
  }

  console.log('✓ Database is empty (except home org)');
};

/**
 * Commit staged records (batch commit)
 * @param {Object} request - supertest request instance
 * @param {Array<string>} uuids - Array of staging UUIDs to commit (optional - if empty or not provided, commits all uncommitted records)
 * @param {boolean} force - Force commit even in short mode (default: false)
 */
export const commitStagedRecords = async (request, uuids = [], force = false) => {
  if (!Array.isArray(uuids)) {
    throw new Error('uuids must be an array');
  }

  // In short mode, only commit if explicitly forced (by master test runner)
  // In extended mode, always commit
  if (!force && !shouldAutoCommit()) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Skipping commit (batch mode - will commit after all operations)`);
    return null;
  }

  // Build request body - only include ids if provided and non-empty
  const body = {
    comment: 'Test commit',
    author: 'Test User',
  };

  if (uuids && uuids.length > 0) {
    body.ids = uuids;
  }

  // Note: Request logging is handled by the request wrapper in getLiveApiRequest()
  // Commit UUIDs if provided, otherwise commit all uncommitted records (no ids field)
  const response = await request
    .post('/v2/staging/commit')
    .send(body);

  if (response.status !== 200) {
    console.error('Commit failed:', {
      status: response.status,
      body: response.body,
      uuids: uuids,
    });
    throw new Error(`Commit failed with status ${response.status}: ${JSON.stringify(response.body)}`);
  }

  return response.body;
};

/**
 * Check if organization is synced (doesn't wait, just checks)
 * Returns true if synced, false if not synced
 */
export const checkOrganizationSynced = async (request) => {
  try {
    const orgsResponse = await request.get('/v2/organizations');

    if (!orgsResponse.body || typeof orgsResponse.body !== 'object') {
      throw new Error('Invalid organizations response');
    }

    // Find home organization
    const orgs = Object.values(orgsResponse.body);
    const homeOrg = orgs.find(org => org.is_home === true || org.isHome === true);

    if (!homeOrg) {
      throw new Error('Home organization not found');
    }

    return homeOrg.synced === true;
  } catch (error) {
    console.warn(`Error checking sync status: ${error.message}`);
    return false;
  }
};

/**
 * Wait for pending commits to complete
 * Checks the home organization's synced field to determine if blockchain sync is complete
 * This is more reliable than checking staging table directly
 */
export const waitForPendingCommits = async (request, maxWaitTime = 600000) => {
  const startTime = Date.now();
  const interval = 10000; // Check every 10 seconds (longer interval for blockchain)
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] Waiting for organization sync to complete...`);

  while (Date.now() - startTime < maxWaitTime) {
    const isSynced = await checkOrganizationSynced(request);

    if (isSynced) {
      console.log('✓ Organization sync complete - safe to proceed');
      return true;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`  Organization not synced yet, waiting... (${elapsed}s elapsed)`);

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Timeout reached - this is a problem, sync is taking too long
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.error(`❌ Timeout waiting for organization sync to complete after ${elapsed}s`);
  throw new Error(`Timeout waiting for organization sync to complete after ${maxWaitTime}ms. Blockchain sync may be taking longer than expected.`);
};

/**
 * Wait for staging table to be empty
 * Polls GET /v2/staging until it returns no records
 * @param {Object} request - supertest request instance
 * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 600000 = 10 minutes)
 */
export const waitForStagingEmpty = async (request, maxWaitTime = 600000) => {
  const startTime = Date.now();
  const interval = 10000; // Check every 10 seconds

  console.log('Waiting for staging table to be empty...');

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await request.get('/v2/staging');
      const records = Array.isArray(response.body)
        ? response.body
        : (response.body?.data || []);

      if (records.length === 0) {
        console.log('✓ Staging table is empty');
        return true;
      }

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`  Staging table still has ${records.length} record(s), waiting... (${elapsed}s elapsed)`);
    } catch (error) {
      console.warn(`  Error checking staging table: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  throw new Error(`Timeout waiting for staging table to be empty after ${elapsed}s`);
};

/**
 * Wait for a single record to appear in database after commit
 * Uses exponential backoff polling
 */
export const waitForDataToAppear = async (request, type, id, maxWaitTime = 600000) => {
  const startTime = Date.now();
  let pollInterval = 5000; // Start with 5 seconds
  const maxInterval = 30000; // Max 30 seconds

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // All tables now use UUID primary keys
      const endpoint = `/v2/${type}/${id}`;

      const response = await request.get(endpoint);
      if (response.status === 200 && response.body) {
        // Record exists!
        return response.body;
      }
    } catch (error) {
      // Record doesn't exist yet, continue polling
      const status = error.response?.status || error.status;
      if (status && status !== 404) {
        // Some other error occurred
        console.warn(`  Error checking ${type}/${JSON.stringify(id)}: ${error.message} (status: ${status})`);
      }
    }

    // Exponential backoff: increase interval after 2 minutes
    if (Date.now() - startTime > 120000) {
      pollInterval = Math.min(pollInterval * 1.5, maxInterval);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Record ${type}/${JSON.stringify(id)} did not appear in database within ${maxWaitTime}ms`);
};

/**
 * Wait for multiple records to appear in database after commit
 * Polls all records in parallel until all exist or timeout
 */
export const waitForBatchToAppear = async (request, records, maxWaitTime = 600000) => {
  const startTime = Date.now();
  let pollInterval = 5000; // Start with 5 seconds
  const maxInterval = 30000; // Max 30 seconds
  const foundRecords = new Set();

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🔍 Waiting for ${records.length} record(s) to appear: ${records.map(r => `${r.type}/${JSON.stringify(r.id)}`).join(', ')}`);

  while (Date.now() - startTime < maxWaitTime && foundRecords.size < records.length) {
    // Poll all records in parallel
    const recordsToCheck = records.filter(record => !foundRecords.has(`${record.type}/${JSON.stringify(record.id)}`));
    console.log(`  Checking ${recordsToCheck.length} record(s): ${recordsToCheck.map(r => `${r.type}/${JSON.stringify(r.id)}`).join(', ')}`);

    const promises = recordsToCheck.map(async (record) => {
      try {
        // All tables now use UUID primary keys
        const endpoint = `/v2/${record.type}/${record.id}`;

        const response = await request.get(endpoint);
        if (response.status === 200 && response.body) {
          foundRecords.add(`${record.type}/${JSON.stringify(record.id)}`);
          console.log(`  ✓ Found: ${record.type}/${JSON.stringify(record.id)}`);
          return { record, found: true, data: response.body };
        }
      } catch (error) {
        const status = error.response?.status || error.status;
        if (status === 404) {
          // Record doesn't exist yet - this is expected
        } else {
          console.log(`  ⚠ Error checking ${record.type}/${JSON.stringify(record.id)}: ${error.message} (status: ${status})`);
        }
      }
      return { record, found: false };
    });

    await Promise.all(promises);

    if (foundRecords.size === records.length) {
      // All records found!
      console.log(`✓ All ${records.length} record(s) found!`);
      return records.map(record => {
        const key = `${record.type}/${JSON.stringify(record.id)}`;
        return foundRecords.has(key);
      });
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`  Still waiting... Found ${foundRecords.size}/${records.length} (${elapsed}s elapsed)`);

    // Exponential backoff: increase interval after 2 minutes
    if (Date.now() - startTime > 120000) {
      pollInterval = Math.min(pollInterval * 1.5, maxInterval);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  const missing = records.filter(record => !foundRecords.has(`${record.type}/${JSON.stringify(record.id)}`));
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.error(`❌ Timeout: Missing ${missing.length} record(s) after ${elapsed}s`);
  throw new Error(
    `Not all records appeared in database within ${maxWaitTime}ms (${elapsed}s elapsed). Missing: ${missing.map(r => `${r.type}/${JSON.stringify(r.id)}`).join(', ')}. Found: ${Array.from(foundRecords).join(', ')}`
  );
};

/**
 * Clear staging table
 * Makes DELETE request to /v2/staging/clean endpoint to delete all staged records
 */
export const clearStagingTable = async (request) => {
  try {
    // Note: Request logging is handled by the request wrapper in getLiveApiRequest()
    const response = await request.delete('/v2/staging/clean');
    if (response.status === 200) {
      console.log('✓ Staging table cleared');
      return true;
    }
  } catch (error) {
    console.error(`❌ Error clearing staging table: ${error.message}`);
    throw error;
  }
};

/**
 * Validate data in database matches expected data
 * Compares fields from expectedData with actual data from GET request
 * @param {Object} request - supertest request instance
 * @param {string} type - Resource type
 * @param {string|object} id - Record ID
 * @param {object} expectedData - Expected data fields
 * @returns {boolean} - true if data matches
 */
export const validateDataInDatabase = async (request, type, id, expectedData) => {
  try {
    // Get actual data - all tables now use UUID primary keys
    const endpoint = `/v2/${type}/${id}`;

    const response = await request.get(endpoint).expect(200);
    const actualData = response.body;

    // Compare expected fields with actual data
    // We verify all fields we sent, but ignore fields the API adds (like cadTrustProjectId, createdAt, updatedAt)
    for (const [key, expectedValue] of Object.entries(expectedData)) {
      // Skip nested child records - they're stored in separate tables
      if (Array.isArray(expectedValue)) {
        continue;
      }

      // Skip if this is a nested object (child records)
      if (expectedValue && typeof expectedValue === 'object' && !Array.isArray(expectedValue) && !(expectedValue instanceof Date)) {
        continue;
      }

      const actualValue = actualData[key];

      // Handle null/undefined equivalence
      if (expectedValue === null && (actualValue === null || actualValue === undefined)) {
        continue;
      }
      if (expectedValue === undefined && (actualValue === null || actualValue === undefined)) {
        continue;
      }

      // Handle date comparisons - API may return full ISO datetime for date-only inputs
      if (typeof expectedValue === 'string' && typeof actualValue === 'string') {
        // Check if both look like dates
        const expectedIsDate = /^\d{4}-\d{2}-\d{2}/.test(expectedValue);
        const actualIsDate = /^\d{4}-\d{2}-\d{2}/.test(actualValue);

        if (expectedIsDate && actualIsDate) {
          // Compare just the date portion (YYYY-MM-DD)
          const expectedDatePart = expectedValue.substring(0, 10);
          const actualDatePart = actualValue.substring(0, 10);
          if (expectedDatePart === actualDatePart) {
            continue; // Dates match
          }
        }
      }

      // Strict comparison - any mismatch is a failure
      if (actualValue !== expectedValue) {
        console.error(`  Field mismatch: ${key} - expected: ${JSON.stringify(expectedValue)}, actual: ${JSON.stringify(actualValue)}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`  Error validating data: ${error.message}`);
    return false;
  }
};

// Wallet sync retry configuration
const WALLET_SYNC_RETRY_INTERVAL = 10000; // 10 seconds
const WALLET_SYNC_MAX_WAIT = 1800000; // 30 minutes

/**
 * Check if response indicates wallet is syncing
 * @param {Object} response - HTTP response object
 * @returns {boolean} - true if wallet sync error detected
 */
const isWalletSyncError = (response) => {
  if (!response) return false;

  // Check response body for wallet sync messages
  const body = response.body || {};
  const message = (body.message || body.error || '').toLowerCase();

  return (
    message.includes('wallet is syncing') ||
    message.includes('wallet syncing') ||
    message.includes('wait for it to sync') ||
    message.includes('wallet not synced')
  );
};

/**
 * Check if response indicates server is in startup phase (coin management)
 * @param {Object} response - HTTP response object
 * @returns {boolean} - true if startup phase error detected
 */
const isStartupPhaseError = (response) => {
  if (!response) return false;

  const body = response.body || {};
  const status = response.status || response.statusCode;

  // 503 with startupPhase indicates coin management is in progress
  return status === 503 && body.startupPhase === 'coin_management';
};

/**
 * Check if response indicates a retryable transient error (wallet sync or startup phase)
 * @param {Object} response - HTTP response object
 * @returns {{retryable: boolean, reason: string}} - whether error is retryable and the reason
 */
const isRetryableError = (response) => {
  if (isStartupPhaseError(response)) {
    return { retryable: true, reason: 'Server still starting (coin management)' };
  }
  if (isWalletSyncError(response)) {
    return { retryable: true, reason: 'Wallet syncing' };
  }
  return { retryable: false, reason: null };
};

/**
 * Create a retryable request wrapper that automatically retries on wallet sync errors
 * @param {Function} makeRequest - Function that creates the supertest request
 * @param {string} method - HTTP method name (POST, PUT, DELETE)
 * @param {string} path - Request path
 * @returns {Object} - Chainable request wrapper with retry logic
 */
const createRetryableRequest = (makeRequest, method, path) => {
  let pendingRequest = makeRequest();
  const chainMethods = []; // Store chained method calls for replay

  const wrapper = {
    // Proxy common chainable methods to capture them for replay
    send(data) {
      chainMethods.push({ name: 'send', args: [data] });
      pendingRequest = pendingRequest.send(data);
      return wrapper;
    },
    set(field, val) {
      chainMethods.push({ name: 'set', args: [field, val] });
      pendingRequest = pendingRequest.set(field, val);
      return wrapper;
    },
    expect(a, b) {
      // expect() can have multiple signatures: expect(status), expect(field, value), etc.
      // Only pass second argument if it's actually provided (not undefined)
      if (b !== undefined) {
        chainMethods.push({ name: 'expect', args: [a, b] });
        pendingRequest = pendingRequest.expect(a, b);
      } else {
        chainMethods.push({ name: 'expect', args: [a] });
        pendingRequest = pendingRequest.expect(a);
      }
      return wrapper;
    },
    query(data) {
      chainMethods.push({ name: 'query', args: [data] });
      pendingRequest = pendingRequest.query(data);
      return wrapper;
    },
    attach(field, file, options) {
      chainMethods.push({ name: 'attach', args: [field, file, options] });
      pendingRequest = pendingRequest.attach(field, file, options);
      return wrapper;
    },
    field(name, val) {
      chainMethods.push({ name: 'field', args: [name, val] });
      pendingRequest = pendingRequest.field(name, val);
      return wrapper;
    },
    type(type) {
      chainMethods.push({ name: 'type', args: [type] });
      pendingRequest = pendingRequest.type(type);
      return wrapper;
    },
    accept(type) {
      chainMethods.push({ name: 'accept', args: [type] });
      pendingRequest = pendingRequest.accept(type);
      return wrapper;
    },
    timeout(ms) {
      chainMethods.push({ name: 'timeout', args: [ms] });
      pendingRequest = pendingRequest.timeout(ms);
      return wrapper;
    },

    // Make this wrapper thenable with retry logic
    then(onFulfilled, onRejected) {
      const startTime = Date.now();

      const executeWithRetry = async () => {
        while (true) {
          try {
            const response = await pendingRequest;

            // Check if response indicates a retryable transient error
            const { retryable, reason } = isRetryableError(response);
            if (retryable) {
              const elapsed = Date.now() - startTime;
              if (elapsed < WALLET_SYNC_MAX_WAIT) {
                const elapsedSec = Math.floor(elapsed / 1000);
                console.log(`[${getTimestamp()}] ⏳ ${reason} detected, retrying ${method} ${path} in 10 seconds... (${elapsedSec}s elapsed)`);
                await new Promise(resolve => setTimeout(resolve, WALLET_SYNC_RETRY_INTERVAL));

                // Recreate and replay the request
                pendingRequest = makeRequest();
                for (const { name, args } of chainMethods) {
                  pendingRequest = pendingRequest[name](...args);
                }
                continue;
              } else {
                console.log(`[${getTimestamp()}] ❌ Retry timeout after ${Math.floor(elapsed / 1000)}s (last reason: ${reason})`);
              }
            }

            return response;
          } catch (error) {
            // Handle error responses (when expect() fails due to status mismatch)
            // The error object may have a .response property with the actual response
            const errorResponse = error.response || error;

            const { retryable, reason } = isRetryableError(errorResponse);
            if (retryable) {
              const elapsed = Date.now() - startTime;
              if (elapsed < WALLET_SYNC_MAX_WAIT) {
                const elapsedSec = Math.floor(elapsed / 1000);
                console.log(`[${getTimestamp()}] ⏳ ${reason} detected (error response), retrying ${method} ${path} in 10 seconds... (${elapsedSec}s elapsed)`);
                await new Promise(resolve => setTimeout(resolve, WALLET_SYNC_RETRY_INTERVAL));

                // Recreate and replay the request
                pendingRequest = makeRequest();
                for (const { name, args } of chainMethods) {
                  pendingRequest = pendingRequest[name](...args);
                }
                continue;
              } else {
                console.log(`[${getTimestamp()}] ❌ Retry timeout after ${Math.floor(elapsed / 1000)}s (last reason: ${reason})`);
              }
            }

            // Not a retryable error, re-throw
            throw error;
          }
        }
      };

      return executeWithRetry().then(onFulfilled, onRejected);
    },

    // Support catch for promise-like behavior
    catch(onRejected) {
      return this.then(undefined, onRejected);
    },

    // Support finally for promise-like behavior
    finally(onFinally) {
      return this.then(
        value => Promise.resolve(onFinally()).then(() => value),
        reason => Promise.resolve(onFinally()).then(() => { throw reason; })
      );
    },
  };

  return wrapper;
};

/**
 * Convenience function to get live API request instance
 * Also checks server health
 *
 * The returned request object has POST/PUT/DELETE methods wrapped with:
 * - Request logging with timestamps
 * - Automatic retry on wallet sync errors (10s interval, 30 min timeout)
 *
 * @param {Object} options - Options
 * @param {string} options.apiVersion - API version to check: 'v1', 'v2', or 'any' (default: 'any')
 */
export const getLiveApiRequest = async (options = {}) => {
  const { apiVersion = 'any' } = options;
  const request = createLiveApiRequest();
  await waitForServer(request, 30000, { apiVersion });

  // Wrap request methods to track endpoints, log timestamps, and add wallet sync retry
  // Only wrap if not already wrapped (check for our custom property)
  if (request._wrappedForLogging) {
    return request;
  }

  const originalPost = request.post.bind(request);
  const originalPut = request.put.bind(request);
  const originalDelete = request.delete.bind(request);

  request.post = function(path) {
    trackTestEndpoint('POST', path);
    console.log(`[${getTimestamp()}] POST ${path}`);
    return createRetryableRequest(() => originalPost(path), 'POST', path);
  };

  request.put = function(path) {
    trackTestEndpoint('PUT', path);
    console.log(`[${getTimestamp()}] PUT ${path}`);
    return createRetryableRequest(() => originalPut(path), 'PUT', path);
  };

  request.delete = function(path) {
    trackTestEndpoint('DELETE', path);
    console.log(`[${getTimestamp()}] DELETE ${path}`);
    return createRetryableRequest(() => originalDelete(path), 'DELETE', path);
  };

  // Mark as wrapped to prevent duplicate wrapping
  request._wrappedForLogging = true;

  return request;
};

/**
 * Wait for V2 organization to be created and ready
 * Polls GET /v2/organizations until organization appears and is synced
 * Also checks /v2/organizations/status for creation progress details
 * @param {Object} request - supertest request instance
 * @param {string} [orgName] - Optional organization name to match (if not provided, finds home org)
 * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 1800000 = 30 minutes)
 * @param {Object} options - Additional options
 * @param {boolean} options.isUpgrade - If true, skip fast-fail checks (upgrade is fully async with no status)
 * @returns {Promise<{orgUid: string, organization: object}>} Organization UID and data
 */
export const waitForV2OrganizationReady = async (request, orgName = null, maxWaitTime = 1800000, options = {}) => {
  const { isUpgrade = false } = options;
  const startTime = Date.now();
  const interval = 10000; // Check every 10 seconds
  const timestamp = getTimestamp();

  console.log(`[${timestamp}] Waiting for V2 organization to be ready...`);
  if (orgName) {
    console.log(`  Looking for organization with name: ${orgName}`);
  } else {
    console.log(`  Looking for home organization`);
  }
  if (isUpgrade) {
    console.log(`  (Upgrade mode: will wait for org to appear without fast-fail)`);
  }

  // Track if we've seen a PENDING org - if it disappears, creation failed
  let sawPendingOrg = false;
  // Track consecutive polls with no orgs and no creation in progress
  let noProgressCount = 0;
  // For upgrades, use a much higher threshold since the process is fully async with no status feedback
  const noProgressThreshold = isUpgrade ? 60 : 6; // 10 minutes for upgrade, 60 seconds for normal creation
  // Track stuck state - if we're in the same state for too long, fail
  let lastState = null;
  let lastStateChangeTime = Date.now();
  const stuckStateThresholdMs = 300000; // 5 minutes stuck in same state = fail

  while (Date.now() - startTime < maxWaitTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    let creationInProgress = false;

    try {
      // First, check creation status endpoint for detailed progress
      try {
        const statusResponse = await request.get('/v2/organizations/status');
        if (statusResponse.status === 200 && statusResponse.body) {
          const status = statusResponse.body;

          // Check for FAILED state - fail fast
          if (status.state === 'FAILED') {
            console.log(`  [${elapsed}s] ❌ Organization creation FAILED!`);
            console.log(`  Error: ${status.error || 'Unknown error'}`);
            console.log(`  Status: ${JSON.stringify(status, null, 2)}`);
            throw new Error(
              `Organization creation failed with state FAILED after ${elapsed}s. ` +
              `Error: ${status.error || 'Unknown error'}`
            );
          }

          // Check if there's active creation
          if (status.inProgress || (status.state && status.state !== 'COMPLETE' && status.state !== 'FAILED')) {
            creationInProgress = true;
            noProgressCount = 0; // Reset counter - we have progress

            // Track state changes to detect stuck creation
            const currentState = status.state;
            const storesInfo = status.stores ? JSON.stringify(
              Object.fromEntries(
                Object.entries(status.stores).map(([k, v]) => [k, { id: v.id, confirmed: v.confirmed }])
              )
            ) : null;
            const stateKey = `${currentState}|${storesInfo}`;

            if (stateKey !== lastState) {
              lastState = stateKey;
              lastStateChangeTime = Date.now();
            } else {
              // Check if stuck in same state for too long
              const stuckDuration = Date.now() - lastStateChangeTime;
              if (stuckDuration > stuckStateThresholdMs) {
                console.log(`  [${elapsed}s] ❌ Organization creation appears stuck!`);
                console.log(`  State '${currentState}' has not changed for ${Math.round(stuckDuration / 1000)}s`);
                console.log(`  Status: ${JSON.stringify(status, null, 2)}`);
                throw new Error(
                  `Organization creation appears stuck at state '${currentState}' for ${Math.round(stuckDuration / 1000)}s. ` +
                  `Wallet or blockchain may not be responding. Check server logs for details.`
                );
              }
            }
          }

          // Only log if there's active creation or interesting state
          if (status.state || status.name || status.stores) {
            console.log(`  [${elapsed}s] Creation status: state=${status.state || 'unknown'}, name="${status.name || 'unnamed'}"`);
            if (status.stores) {
              const storeNames = Object.keys(status.stores);
              const storesSummary = storeNames.map(name => {
                const store = status.stores[name];
                // Check if store has ID (id !== null means store is created)
                const hasId = store.id !== null && store.id !== undefined;
                return `${name}:${hasId ? 'created' : 'pending'}/${store.confirmed ? 'confirmed' : 'unconfirmed'}`;
              }).join(', ');
              console.log(`    Stores: ${storesSummary}`);
            }
            if (status.message) {
              console.log(`    Message: ${status.message}`);
            }
          }
        }
      } catch (statusError) {
        // Re-throw stuck state errors
        if (statusError.message?.includes('appears stuck')) {
          throw statusError;
        }
        // Status endpoint might not exist or may fail - that's okay
        if (statusError.response?.status !== 404 && statusError.response?.status !== 403) {
          console.log(`  [${elapsed}s] Status check error: ${statusError.message}`);
        }
      }

      // Now check organizations list
      const response = await request.get('/v2/organizations');

      if (response.status === 200 && response.body && typeof response.body === 'object') {
        // Response is an object keyed by org_uid: { "org_uid": { org data }, ... }
        const orgs = Object.values(response.body);

        // Always log organization status for debugging
        console.log(`  [${elapsed}s] Found ${orgs.length} organization(s) in V2:`);
        orgs.forEach((o, i) => {
          const name = o.name || o.orgName || 'unnamed';
          const uid = o.org_uid || o.orgUid || 'no-uid';
          const isHome = o.is_home || o.isHome || false;
          const synced = o.synced !== undefined ? o.synced : 'unknown';
          const uidDisplay = uid === 'PENDING' ? 'PENDING' : `${uid.substring(0, 8)}...`;
          console.log(`    ${i + 1}. "${name}" (uid: ${uidDisplay}, isHome: ${isHome}, synced: ${synced})`);
        });

        // Find matching organization
        let org = null;
        if (orgName) {
          // First try: find by name AND isHome
          org = orgs.find(o =>
            (o.name === orgName || o.orgName === orgName) &&
            (o.is_home === true || o.isHome === true)
          );

          // Second try: if not found, find by name only
          if (!org) {
            org = orgs.find(o => o.name === orgName || o.orgName === orgName);
            if (org) {
              const isHome = org.is_home || org.isHome || false;
              if (!isHome) {
                console.log(`  [${elapsed}s] Found org "${orgName}" but isHome=${isHome}, waiting for it to become home org...`);
                org = null; // Keep waiting
              }
            }
          }
        } else {
          // Find home org (but not PENDING placeholder)
          org = orgs.find(o =>
            (o.is_home === true || o.isHome === true) &&
            (o.org_uid !== 'PENDING' && o.orgUid !== 'PENDING')
          );
        }

        if (org) {
          // Check if organization is synced (V2 requirement)
          const isSynced = org.synced === true;
          const orgUid = org.org_uid || org.orgUid;

          if (isSynced && orgUid && orgUid !== 'PENDING') {
            console.log(`✓ V2 Organization ready: ${orgUid}`);
            console.log(`  Name: ${org.name || org.orgName}`);
            console.log(`  isHome: ${org.is_home || org.isHome}`);
            console.log(`  synced: ${org.synced}`);
            return {
              orgUid,
              organization: org,
            };
          } else {
            console.log(`  [${elapsed}s] Organization found but not ready yet (uid=${orgUid}, synced=${isSynced})`);
          }
        } else {
          // Check if there's a PENDING org (creation in progress)
          const pendingOrg = orgs.find(o => o.org_uid === 'PENDING' || o.orgUid === 'PENDING');
          if (pendingOrg) {
            sawPendingOrg = true;
            creationInProgress = true;
            noProgressCount = 0; // Reset counter
            console.log(`  [${elapsed}s] Organization creation in progress (PENDING record exists)`);
          } else if (sawPendingOrg && orgs.length === 0) {
            // We had a PENDING org but now it's gone with no replacement - creation failed
            console.log(`  [${elapsed}s] ❌ PENDING organization disappeared - creation failed!`);

            // Try to get more details about what went wrong
            try {
              const statusResponse = await request.get('/v2/organizations/status');
              if (statusResponse.body) {
                console.log(`  Final status: ${JSON.stringify(statusResponse.body, null, 2)}`);
              }
            } catch (e) {
              console.log(`  Could not get final status: ${e.message}`);
            }

            throw new Error(
              `Organization creation failed. PENDING organization was cleaned up after ${elapsed}s. ` +
              `Check server logs for details about why creation failed.`
            );
          } else {
            console.log(`  [${elapsed}s] Organization "${orgName || 'home'}" not found yet`);

            // Track no progress - if no PENDING org and no creation in progress for too long, fail fast
            if (!creationInProgress && orgs.length === 0) {
              noProgressCount++;
              if (noProgressCount >= noProgressThreshold) {
                console.log(`  [${elapsed}s] ❌ No organization creation progress detected after ${noProgressCount * 10}s`);

                // Try to get status
                try {
                  const statusResponse = await request.get('/v2/organizations/status');
                  if (statusResponse.body) {
                    console.log(`  Final status: ${JSON.stringify(statusResponse.body, null, 2)}`);
                  }
                } catch (e) {
                  console.log(`  Could not get final status: ${e.message}`);
                }

                throw new Error(
                  `Organization creation appears to have failed. No PENDING organization or creation progress detected after ${elapsed}s. ` +
                  `Check server logs for details about why creation failed.`
                );
              }
            }
          }
        }
      } else {
        console.log(`  [${elapsed}s] GET /v2/organizations returned status ${response.status}`);
        if (response.body) {
          console.log(`  Response: ${JSON.stringify(response.body).substring(0, 200)}`);
        }
      }
    } catch (error) {
      // Re-throw fatal errors (like PENDING org disappeared, no progress, or stuck state) - don't swallow them
      if (error.message.includes('PENDING organization was cleaned up') ||
          error.message.includes('Organization creation failed') ||
          error.message.includes('Organization creation appears to have failed') ||
          error.message.includes('appears stuck') ||
          error.message.includes('creation FAILED')) {
        throw error;
      }
      console.log(`  [${elapsed}s] Error checking organizations: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Timeout - do a final status dump
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`\n❌ TIMEOUT after ${elapsed}s waiting for V2 organization`);

  try {
    const finalResponse = await request.get('/v2/organizations');
    if (finalResponse.status === 200 && finalResponse.body) {
      const orgs = Object.values(finalResponse.body);
      console.log(`Final organization state (${orgs.length} orgs):`);
      orgs.forEach((o, i) => {
        console.log(`  ${i + 1}. ${JSON.stringify(o)}`);
      });
    }
  } catch (e) {
    console.log(`Could not get final org state: ${e.message}`);
  }

  // Also try to get final creation status
  try {
    const finalStatusResponse = await request.get('/v2/organizations/status');
    if (finalStatusResponse.status === 200 && finalStatusResponse.body) {
      console.log(`Final creation status: ${JSON.stringify(finalStatusResponse.body, null, 2)}`);
    }
  } catch (e) {
    console.log(`Could not get final creation status: ${e.message}`);
  }

  throw new Error(
    `Timeout waiting for V2 organization to be ready after ${elapsed}s (${maxWaitTime}ms). ` +
    `Organization creation may be taking longer than expected.`
  );
};

/**
 * Wait for V1 organization to be created and ready
 * Polls GET /v1/organizations until organization appears
 * Also checks /v1/organizations/creation-status for creation progress details
 * @param {Object} request - supertest request instance
 * @param {string} [orgName] - Optional organization name to match (if not provided, finds home org)
 * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 1800000 = 30 minutes)
 * @returns {Promise<{orgUid: string, organization: object}>} Organization UID and data
 */
export const waitForV1OrganizationReady = async (request, orgName = null, maxWaitTime = 1800000) => {
  const startTime = Date.now();
  const interval = 10000; // Check every 10 seconds
  const timestamp = getTimestamp();

  console.log(`[${timestamp}] Waiting for V1 organization to be ready...`);
  if (orgName) {
    console.log(`  Looking for organization with name: ${orgName}`);
  } else {
    console.log(`  Looking for home organization`);
  }

  // Track if we've seen a PENDING org - if it disappears, creation failed
  let sawPendingOrg = false;
  // Track consecutive polls with no orgs and no creation in progress
  let noProgressCount = 0;
  const noProgressThreshold = 6; // After 60 seconds (6 x 10s interval) with no progress, fail fast
  // Track stuck state - if we're in the same state for too long, fail
  let lastState = null;
  let lastStateChangeTime = Date.now();
  const stuckStateThresholdMs = 300000; // 5 minutes stuck in same state = fail

  while (Date.now() - startTime < maxWaitTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    let creationInProgress = false;

    try {
      // First, check creation status endpoint for detailed progress
      try {
        const statusResponse = await request.get('/v1/organizations/creation-status');
        if (statusResponse.status === 200 && statusResponse.body) {
          const status = statusResponse.body;

          // Check for FAILED state - fail fast
          if (status.state === 'FAILED') {
            console.log(`  [${elapsed}s] ❌ Organization creation FAILED!`);
            console.log(`  Error: ${status.error || 'Unknown error'}`);
            console.log(`  Status: ${JSON.stringify(status, null, 2)}`);
            throw new Error(
              `Organization creation failed with state FAILED after ${elapsed}s. ` +
              `Error: ${status.error || 'Unknown error'}`
            );
          }

          // Check if there's active creation
          if (status.inProgress || (status.state && status.state !== 'COMPLETE' && status.state !== 'FAILED')) {
            creationInProgress = true;
            noProgressCount = 0; // Reset counter - we have progress

            // Track state changes to detect stuck creation
            const currentState = status.state;
            const storesInfo = status.stores ? JSON.stringify(
              Object.fromEntries(
                Object.entries(status.stores).map(([k, v]) => [k, { id: v.id, confirmed: v.confirmed }])
              )
            ) : null;
            const stateKey = `${currentState}|${storesInfo}`;

            if (stateKey !== lastState) {
              lastState = stateKey;
              lastStateChangeTime = Date.now();
            } else {
              // Check if stuck in same state for too long
              const stuckDuration = Date.now() - lastStateChangeTime;
              if (stuckDuration > stuckStateThresholdMs) {
                console.log(`  [${elapsed}s] ❌ Organization creation appears stuck!`);
                console.log(`  State '${currentState}' has not changed for ${Math.round(stuckDuration / 1000)}s`);
                console.log(`  Status: ${JSON.stringify(status, null, 2)}`);
                throw new Error(
                  `Organization creation appears stuck at state '${currentState}' for ${Math.round(stuckDuration / 1000)}s. ` +
                  `Wallet or blockchain may not be responding. Check server logs for details.`
                );
              }
            }
          }

          // Only log if there's active creation or interesting state
          if (status.state || status.name || status.stores) {
            console.log(`  [${elapsed}s] Creation status: state=${status.state || 'unknown'}, name="${status.name || 'unnamed'}"`);
            if (status.stores) {
              const storeNames = Object.keys(status.stores);
              const storesSummary = storeNames.map(name => {
                const store = status.stores[name];
                // Check if store has ID (id !== null means store is created)
                const hasId = store.id !== null && store.id !== undefined;
                return `${name}:${hasId ? 'created' : 'pending'}/${store.confirmed ? 'confirmed' : 'unconfirmed'}`;
              }).join(', ');
              console.log(`    Stores: ${storesSummary}`);
            }
            if (status.message) {
              console.log(`    Message: ${status.message}`);
            }
          }
        }
      } catch (statusError) {
        // Re-throw stuck state errors
        if (statusError.message?.includes('appears stuck')) {
          throw statusError;
        }
        // Status endpoint might not exist or may fail - that's okay
        if (statusError.response?.status !== 404 && statusError.response?.status !== 403) {
          console.log(`  [${elapsed}s] Status check error: ${statusError.message}`);
        }
      }

      // Now check organizations list
      const response = await request.get('/v1/organizations');

      if (response.status === 200) {
        // V1 response format is a map keyed by orgUid: {"orgUid": {...}, ...}
        // Convert to array using Object.values()
        let orgs;
        if (Array.isArray(response.body)) {
          orgs = response.body;
        } else if (response.body?.data) {
          orgs = response.body.data;
        } else if (typeof response.body === 'object' && response.body !== null) {
          // V1 returns a map keyed by orgUid - convert to array
          orgs = Object.values(response.body);
        } else {
          orgs = [];
        }

        // Always log organization status for debugging
        console.log(`  [${elapsed}s] Found ${orgs.length} organization(s) in V1:`);
        orgs.forEach((o, i) => {
          const name = o.name || o.orgName || 'unnamed';
          const uid = o.orgUid || o.org_uid || 'no-uid';
          const isHome = o.isHome || o.is_home || false;
          const synced = o.synced !== undefined ? o.synced : 'unknown';
          const uidDisplay = uid === 'PENDING' ? 'PENDING' : `${uid.substring(0, 8)}...`;
          console.log(`    ${i + 1}. "${name}" (uid: ${uidDisplay}, isHome: ${isHome}, synced: ${synced})`);
        });

        // Find matching organization
        let org = null;
        if (orgName) {
          // First try: find by name AND isHome
          org = orgs.find(o =>
            (o.name === orgName || o.orgName === orgName) &&
            (o.isHome === true || o.is_home === true)
          );

          // Second try: if not found, find by name only (might not be home yet)
          if (!org) {
            org = orgs.find(o => o.name === orgName || o.orgName === orgName);
            if (org) {
              const isHome = org.isHome || org.is_home || false;
              if (!isHome) {
                console.log(`  [${elapsed}s] Found org "${orgName}" but isHome=${isHome}, waiting for it to become home org...`);
                org = null; // Keep waiting
              }
            }
          }
        } else {
          // Find home org (but not PENDING placeholder)
          org = orgs.find(o =>
            (o.isHome === true || o.is_home === true) &&
            (o.orgUid !== 'PENDING' && o.org_uid !== 'PENDING')
          );
        }

        if (org) {
          const orgUid = org.orgUid || org.org_uid;
          const isSynced = org.synced === true;
          const orgHash = org.orgHash || org.org_hash;
          const dataModelVersionStoreHash = org.dataModelVersionStoreHash || org.data_model_version_store_hash;

          // Check if hashes are populated (not null and not all zeros)
          // - orgHash being populated indicates the org store has data (name, icon, registryId, fileStoreId)
          // - dataModelVersionStoreHash being populated indicates the v1 key was written to the singleton
          const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
          const hasValidOrgHash = orgHash && orgHash !== nullHash && orgHash !== '0';
          const hasValidDataModelHash = dataModelVersionStoreHash && dataModelVersionStoreHash !== nullHash && dataModelVersionStoreHash !== '0';

          // Organization is ready when:
          // 1. synced is true
          // 2. orgUid exists and is not PENDING
          // 3. orgHash is populated (indicates org store data was written)
          // 4. CRITICAL: dataModelVersionStoreHash is populated (indicates v1 key was written to singleton)
          const isFullyReady = isSynced && orgUid && orgUid !== 'PENDING' && hasValidOrgHash && hasValidDataModelHash;

          if (isFullyReady) {
            console.log(`✓ V1 Organization ready: ${orgUid}`);
            console.log(`  Name: ${org.name || org.orgName}`);
            console.log(`  isHome: ${org.isHome || org.is_home}`);
            console.log(`  synced: ${org.synced}`);
            console.log(`  orgHash: ${orgHash}`);
            console.log(`  dataModelVersionStoreHash: ${dataModelVersionStoreHash}`);
            console.log(`  registryHash: ${org.registryHash || org.registry_hash}`);
            return {
              orgUid,
              organization: org,
            };
          } else if (orgUid && orgUid !== 'PENDING') {
            // Org exists but not fully ready yet - keep waiting
            if (!hasValidOrgHash) {
              console.log(`  [${elapsed}s] Organization found but org store data not yet written (orgHash=${orgHash || 'null'})`);
            } else if (!hasValidDataModelHash) {
              console.log(`  [${elapsed}s] Organization found but singleton data not yet written (dataModelVersionStoreHash=${dataModelVersionStoreHash || 'null'})`);
            } else if (!isSynced) {
              console.log(`  [${elapsed}s] Organization found but not synced yet (uid=${orgUid.substring(0, 8)}..., synced=${org.synced})`);
            } else {
              console.log(`  [${elapsed}s] Organization found but not ready yet (uid=${orgUid}, synced=${isSynced}, hasOrgHash=${hasValidOrgHash}, hasDataModelHash=${hasValidDataModelHash})`);
            }
          } else {
            console.log(`  [${elapsed}s] Organization found but not ready yet (uid=${orgUid})`);
          }
        } else {
          // Check if there's a PENDING org (creation in progress)
          const pendingOrg = orgs.find(o => o.orgUid === 'PENDING' || o.org_uid === 'PENDING');
          if (pendingOrg) {
            sawPendingOrg = true;
            creationInProgress = true;
            noProgressCount = 0; // Reset counter
            console.log(`  [${elapsed}s] Organization creation in progress (PENDING record exists)`);
          } else if (sawPendingOrg && orgs.length === 0) {
            // We had a PENDING org but now it's gone with no replacement - creation failed
            console.log(`  [${elapsed}s] ❌ PENDING organization disappeared - creation failed!`);

            // Try to get more details about what went wrong
            try {
              const statusResponse = await request.get('/v1/organizations/creation-status');
              if (statusResponse.body) {
                console.log(`  Final status: ${JSON.stringify(statusResponse.body, null, 2)}`);
              }
            } catch (e) {
              console.log(`  Could not get final status: ${e.message}`);
            }

            throw new Error(
              `Organization creation failed. PENDING organization was cleaned up after ${elapsed}s. ` +
              `Check server logs for details about why creation failed.`
            );
          } else {
            console.log(`  [${elapsed}s] Organization "${orgName || 'home'}" not found yet`);

            // Track no progress - if no PENDING org and no creation in progress for too long, fail fast
            if (!creationInProgress && orgs.length === 0) {
              noProgressCount++;
              if (noProgressCount >= noProgressThreshold) {
                console.log(`  [${elapsed}s] ❌ No organization creation progress detected after ${noProgressCount * 10}s`);

                // Try to get status
                try {
                  const statusResponse = await request.get('/v1/organizations/creation-status');
                  if (statusResponse.body) {
                    console.log(`  Final status: ${JSON.stringify(statusResponse.body, null, 2)}`);
                  }
                } catch (e) {
                  console.log(`  Could not get final status: ${e.message}`);
                }

                throw new Error(
                  `Organization creation appears to have failed. No PENDING organization or creation progress detected after ${elapsed}s. ` +
                  `Check server logs for details about why creation failed.`
                );
              }
            }
          }
        }
      } else {
        console.log(`  [${elapsed}s] GET /v1/organizations returned status ${response.status}`);
        if (response.body) {
          console.log(`  Response: ${JSON.stringify(response.body).substring(0, 200)}`);
        }
      }
    } catch (error) {
      // Re-throw fatal errors (like PENDING org disappeared, no progress, or stuck state) - don't swallow them
      if (error.message.includes('PENDING organization was cleaned up') ||
          error.message.includes('Organization creation failed') ||
          error.message.includes('Organization creation appears to have failed') ||
          error.message.includes('appears stuck') ||
          error.message.includes('creation FAILED')) {
        throw error;
      }
      console.log(`  [${elapsed}s] Error checking organizations: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Timeout - do a final status dump
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`\n❌ TIMEOUT after ${elapsed}s waiting for V1 organization`);

  try {
    const finalResponse = await request.get('/v1/organizations');
    if (finalResponse.status === 200) {
      const orgs = Array.isArray(finalResponse.body)
        ? finalResponse.body
        : (finalResponse.body?.data || []);
      console.log(`Final organization state (${orgs.length} orgs):`);
      orgs.forEach((o, i) => {
        console.log(`  ${i + 1}. ${JSON.stringify(o)}`);
      });
    }
  } catch (e) {
    console.log(`Could not get final org state: ${e.message}`);
  }

  // Also try to get final creation status
  try {
    const finalStatusResponse = await request.get('/v1/organizations/creation-status');
    if (finalStatusResponse.status === 200 && finalStatusResponse.body) {
      console.log(`Final creation status: ${JSON.stringify(finalStatusResponse.body, null, 2)}`);
    }
  } catch (e) {
    console.log(`Could not get final creation status: ${e.message}`);
  }

  throw new Error(
    `Timeout waiting for V1 organization to be ready after ${elapsed}s (${maxWaitTime}ms). ` +
    `Organization creation may be taking longer than expected.`
  );
};
