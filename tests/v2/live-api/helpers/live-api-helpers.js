import supertest from 'supertest';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getChiaRoot } from '../../../../src/utils/chia-root.js';

/**
 * Read production config from ~/.chia/mainnet/cadt/config.yaml
 * This reads the actual production config, not test config
 */
export const getLiveApiConfig = () => {
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

  return { baseUrl, port, config };
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
 * Check if database is empty (warns if not, doesn't fail)
 * Checks all data tables to see if they have records
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
      if (response.status === 200 && Array.isArray(response.body) && response.body.length > 0) {
        nonEmptyTables.push({ table, count: response.body.length });
      }
    } catch (error) {
      // Table might not exist or endpoint might not be available, skip
    }
  }

  if (nonEmptyTables.length > 0) {
    console.warn('⚠️  Database is not empty. Found data in:');
    nonEmptyTables.forEach(({ table, count }) => {
      console.warn(`   - ${table}: ${count} record(s)`);
    });
    console.warn('   Tests may have unexpected results.');
  } else {
    console.log('✓ Database appears to be empty (except home org)');
  }
};

/**
 * Commit staged records (batch commit)
 * @param {Object} request - supertest request instance
 * @param {Array<string>} uuids - Array of staging UUIDs to commit (optional - if empty, commits all uncommitted records)
 */
export const commitStagedRecords = async (request, uuids = []) => {
  if (!Array.isArray(uuids)) {
    throw new Error('uuids must be an array');
  }

  // Commit UUIDs if provided, otherwise commit all uncommitted records
  const response = await request
    .post('/v2/staging/commit')
    .send({ ids: uuids });

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
 * Wait for pending commits to complete
 * Polls /v2/staging/pending until no pending commits remain
 */
export const waitForPendingCommits = async (request, maxWaitTime = 300000) => {
  const startTime = Date.now();
  const interval = 5000; // Check every 5 seconds

  while (Date.now() - startTime < maxWaitTime) {
    const response = await request.get('/v2/staging/pending');
    if (response.body.confirmed === true) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Timeout reached, but don't fail - just warn
  console.warn('⚠️  Timeout waiting for pending commits to complete');
  return false;
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
      const response = await request.get(`/v2/${type}/${id}`);
      if (response.status === 200 && response.body) {
        // Record exists!
        return response.body;
      }
    } catch (error) {
      // Record doesn't exist yet, continue polling
    }

    // Exponential backoff: increase interval after 2 minutes
    if (Date.now() - startTime > 120000) {
      pollInterval = Math.min(pollInterval * 1.5, maxInterval);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Record ${type}/${id} did not appear in database within ${maxWaitTime}ms`);
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

  while (Date.now() - startTime < maxWaitTime && foundRecords.size < records.length) {
    // Poll all records in parallel
    const promises = records
      .filter(record => !foundRecords.has(`${record.type}/${record.id}`))
      .map(async (record) => {
        try {
          const response = await request.get(`/v2/${record.type}/${record.id}`);
          if (response.status === 200 && response.body) {
            foundRecords.add(`${record.type}/${record.id}`);
            return { record, found: true, data: response.body };
          }
        } catch (error) {
          // Record doesn't exist yet
        }
        return { record, found: false };
      });

    await Promise.all(promises);

    if (foundRecords.size === records.length) {
      // All records found!
      return records.map(record => {
        const key = `${record.type}/${record.id}`;
        return foundRecords.has(key);
      });
    }

    // Exponential backoff: increase interval after 2 minutes
    if (Date.now() - startTime > 120000) {
      pollInterval = Math.min(pollInterval * 1.5, maxInterval);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  const missing = records.filter(record => !foundRecords.has(`${record.type}/${record.id}`));
  throw new Error(
    `Not all records appeared in database within ${maxWaitTime}ms. Missing: ${missing.map(r => `${r.type}/${r.id}`).join(', ')}`
  );
};

/**
 * Convenience function to get live API request instance
 * Also checks server health
 */
export const getLiveApiRequest = async () => {
  const request = createLiveApiRequest();
  await waitForServer(request);
  return request;
};
