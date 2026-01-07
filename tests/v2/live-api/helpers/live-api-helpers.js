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
  const baseUrl = `http://localhost:${port}`;

  console.log(`Using API endpoint: ${baseUrl} (port: ${port})`);

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
 */
export const waitForServer = async (request, maxWaitTime = 30000) => {
  const startTime = Date.now();
  const interval = 2000; // Check every 2 seconds

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await request.get('/v2/health');
      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Server not ready after ${maxWaitTime}ms`);
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

/**
 * Convenience function to get live API request instance
 * Also checks server health
 */
export const getLiveApiRequest = async () => {
  const request = createLiveApiRequest();
  await waitForServer(request);

  // Wrap request methods to track endpoints and log timestamps
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
    return originalPost(path);
  };

  request.put = function(path) {
    trackTestEndpoint('PUT', path);
    console.log(`[${getTimestamp()}] PUT ${path}`);
    return originalPut(path);
  };

  request.delete = function(path) {
    trackTestEndpoint('DELETE', path);
    console.log(`[${getTimestamp()}] DELETE ${path}`);
    return originalDelete(path);
  };

  // Mark as wrapped to prevent duplicate wrapping
  request._wrappedForLogging = true;

  return request;
};

/**
 * Wait for V2 organization to be created and ready
 * Polls GET /v2/organizations until organization appears and is synced
 * @param {Object} request - supertest request instance
 * @param {string} [orgName] - Optional organization name to match (if not provided, finds home org)
 * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 1800000 = 30 minutes)
 * @returns {Promise<{orgUid: string, organization: object}>} Organization UID and data
 */
export const waitForV2OrganizationReady = async (request, orgName = null, maxWaitTime = 1800000) => {
  const startTime = Date.now();
  const interval = 10000; // Check every 10 seconds
  const timestamp = getTimestamp();

  console.log(`[${timestamp}] Waiting for V2 organization to be ready...`);
  if (orgName) {
    console.log(`  Looking for organization with name: ${orgName}`);
  } else {
    console.log(`  Looking for home organization`);
  }

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await request.get('/v2/organizations');

      if (response.status === 200 && response.body && typeof response.body === 'object') {
        // Response is an object keyed by org_uid: { "org_uid": { org data }, ... }
        const orgs = Object.values(response.body);

        // Find matching organization
        let org = null;
        if (orgName) {
          org = orgs.find(o =>
            (o.name === orgName || o.orgName === orgName) &&
            (o.is_home === true || o.isHome === true)
          );
        } else {
          // Find home org
          org = orgs.find(o => o.is_home === true || o.isHome === true);
        }

        if (org) {
          // Check if organization is synced (V2 requirement)
          const isSynced = org.synced === true;
          const orgUid = org.org_uid || org.orgUid;

          if (isSynced && orgUid) {
            console.log(`✓ V2 Organization ready: ${orgUid}`);
            return {
              orgUid,
              organization: org,
            };
          } else {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            console.log(`  Organization found but not synced yet (${elapsed}s elapsed)`);
          }
        } else {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          console.log(`  Organization not found yet (${elapsed}s elapsed)`);
        }
      }
    } catch (error) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`  Error checking organizations: ${error.message} (${elapsed}s elapsed)`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  throw new Error(
    `Timeout waiting for V2 organization to be ready after ${elapsed}s (${maxWaitTime}ms). ` +
    `Organization creation may be taking longer than expected.`
  );
};

/**
 * Wait for V1 organization to be created and ready
 * Polls GET /v1/organizations until organization appears
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

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await request.get('/v1/organizations');

      if (response.status === 200) {
        // V1 response format may be array or object
        const orgs = Array.isArray(response.body)
          ? response.body
          : (response.body?.data || []);

        // Find matching organization
        let org = null;
        if (orgName) {
          org = orgs.find(o =>
            (o.name === orgName || o.orgName === orgName) &&
            (o.isHome === true || o.is_home === true)
          );
        } else {
          // Find home org
          org = orgs.find(o => o.isHome === true || o.is_home === true);
        }

        if (org) {
          const orgUid = org.orgUid || org.org_uid;
          if (orgUid) {
            console.log(`✓ V1 Organization ready: ${orgUid}`);
            return {
              orgUid,
              organization: org,
            };
          }
        } else {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          console.log(`  Organization not found yet (${elapsed}s elapsed)`);
        }
      }
    } catch (error) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`  Error checking organizations: ${error.message} (${elapsed}s elapsed)`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  throw new Error(
    `Timeout waiting for V1 organization to be ready after ${elapsed}s (${maxWaitTime}ms). ` +
    `Organization creation may be taking longer than expected.`
  );
};
