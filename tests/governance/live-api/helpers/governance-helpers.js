/**
 * Governance-specific test helpers for live API tests.
 * Provides functions for creating governance bodies, setting governance data,
 * and waiting for on-chain confirmation.
 */
import {
  getLiveApiConfig,
  createLiveApiRequest,
  waitForServer,
} from '../../../v2/live-api/helpers/live-api-helpers.js';

const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
};

/**
 * Get a supertest request instance with server health check.
 * Thin wrapper around the shared getLiveApiRequest that avoids importing
 * shared-state (which governance tests don't need).
 *
 * @param {Object} options
 * @param {string} options.apiVersion - 'v1', 'v2', or 'any'
 * @returns {Promise<Object>} supertest request instance
 */
export const getGovernanceApiRequest = async (options = {}) => {
  const { apiVersion = 'any' } = options;
  const request = createLiveApiRequest();
  await waitForServer(request, 60000, { apiVersion });
  return request;
};

/**
 * Create a governance body via the API with wallet-sync retry logic.
 *
 * @param {Object} request - supertest request instance
 * @param {string} apiVersion - 'v1' or 'v2'
 * @param {number} maxWaitMinutes - max time to retry on wallet errors
 * @returns {Promise<{response: Object, lastError: string|null}>}
 */
export const createGovernanceBodyWithRetry = async (request, apiVersion, maxWaitMinutes = 10) => {
  const maxWaitMs = maxWaitMinutes * 60 * 1000;
  const retryDelayMs = 30000;
  const startTime = Date.now();
  const endpoint = `/${apiVersion}/governance`;
  let response;
  let lastError = null;
  let attempt = 0;

  while (true) {
    attempt++;
    response = await request.post(endpoint).send({});

    const isWalletError = response.status === 400 &&
      (response.body?.error?.includes('wallet is syncing') ||
       response.body?.error?.includes('wallet is not available') ||
       response.body?.error?.includes('Wallet') ||
       response.body?.message === 'Chia Exception');

    const isStartupError = response.status === 503 &&
      response.body?.startupPhase === 'coin_management';

    if (response.status === 200) {
      break;
    }

    const elapsed = Date.now() - startTime;

    if ((isWalletError || isStartupError) && elapsed < maxWaitMs) {
      const reason = isStartupError ? 'Server still starting (coin management)' : 'Wallet not ready';
      const elapsedMin = Math.floor(elapsed / 60000);
      const elapsedSec = Math.floor((elapsed % 60000) / 1000);
      console.log(`[Attempt ${attempt}] ${reason}, retrying in ${retryDelayMs / 1000}s... (${elapsedMin}m ${elapsedSec}s elapsed)`);
      console.log(`  Error: ${response.body?.error || response.body?.message}`);
      lastError = response.body?.error || response.body?.message;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    } else {
      if (elapsed >= maxWaitMs) {
        console.log(`[Attempt ${attempt}] Max wait time of ${maxWaitMinutes} minutes reached`);
        lastError = response.body?.error || response.body?.message;
      }
      break;
    }
  }

  return { response, lastError, attempt };
};

/**
 * Poll GET /vX/governance/exists until created: true.
 * Returns the main governance body ID.
 *
 * @param {Object} request - supertest instance
 * @param {string} apiVersion - 'v1' or 'v2'
 * @param {number} maxWaitMs - timeout (default 30 minutes)
 * @returns {Promise<string>} main governance body store ID
 */
export const waitForGovernanceCreated = async (request, apiVersion, maxWaitMs = 900000) => {
  const startTime = Date.now();
  const interval = 10000;
  const endpoint = `/${apiVersion}/governance/exists`;

  console.log(`[${getTimestamp()}] Waiting for ${apiVersion} governance body to be created...`);

  while (Date.now() - startTime < maxWaitMs) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    try {
      const response = await request.get(endpoint);

      if (response.status === 200 && response.body) {
        const { created, governanceBodyId } = response.body;

        if (created === true && governanceBodyId) {
          console.log(`[${getTimestamp()}] ${apiVersion} governance body created: ${governanceBodyId}`);
          return governanceBodyId;
        }

        console.log(`  [${elapsed}s] ${apiVersion} governance not created yet (created=${created})`);
      } else {
        console.log(`  [${elapsed}s] ${endpoint} returned status ${response.status}`);
      }
    } catch (error) {
      console.log(`  [${elapsed}s] Error checking governance exists: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  throw new Error(`Timeout waiting for ${apiVersion} governance body creation after ${elapsed}s`);
};

/**
 * Set governance metadata (pickList, glossary, or orgList) via the API.
 *
 * @param {Object} request - supertest instance
 * @param {string} apiVersion - 'v1' or 'v2'
 * @param {'pickList'|'glossary'|'orgList'} metaType - which metadata to set
 * @param {Object|Array} data - the data payload
 * @returns {Promise<Object>} API response
 */
export const setGovernanceData = async (request, apiVersion, metaType, data) => {
  const endpoint = `/${apiVersion}/governance/meta/${metaType}`;
  console.log(`[${getTimestamp()}] Setting ${apiVersion} governance ${metaType}...`);

  const response = await request
    .post(endpoint)
    .send(data);

  if (response.status !== 200) {
    console.error(`  POST ${endpoint} failed: ${response.status} - ${JSON.stringify(response.body)}`);
    throw new Error(`Failed to set ${apiVersion} governance ${metaType}: ${response.body?.error || response.body?.message}`);
  }

  console.log(`  ${apiVersion} governance ${metaType} submitted: ${response.body?.message}`);
  return response;
};

/**
 * Poll GET /vX/governance until specified keys have confirmed: true.
 *
 * @param {Object} request - supertest instance
 * @param {string} apiVersion - 'v1' or 'v2'
 * @param {string[]} keys - meta keys to wait for (e.g. ['pickList', 'glossary', 'orgList'])
 * @param {number} maxWaitMs - timeout (default 10 minutes)
 * @returns {Promise<Object[]>} confirmed governance records
 */
export const waitForGovernanceDataConfirmed = async (request, apiVersion, keys, maxWaitMs = 600000) => {
  const startTime = Date.now();
  const interval = 10000;
  const endpoint = `/${apiVersion}/governance`;
  const keyField = apiVersion === 'v2' ? 'meta_key' : 'metaKey';
  const confirmedField = 'confirmed';

  console.log(`[${getTimestamp()}] Waiting for ${apiVersion} governance data to be confirmed: [${keys.join(', ')}]`);

  while (Date.now() - startTime < maxWaitMs) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    try {
      const response = await request.get(endpoint);

      if (response.status === 200 && Array.isArray(response.body)) {
        const records = response.body;
        const pendingKeys = [];

        for (const key of keys) {
          const record = records.find(r => r[keyField] === key);
          if (!record) {
            pendingKeys.push(`${key} (not found)`);
          } else if (!record[confirmedField]) {
            pendingKeys.push(`${key} (unconfirmed)`);
          }
        }

        if (pendingKeys.length === 0) {
          console.log(`[${getTimestamp()}] All ${apiVersion} governance data confirmed: [${keys.join(', ')}]`);
          return records.filter(r => keys.includes(r[keyField]));
        }

        console.log(`  [${elapsed}s] Pending: ${pendingKeys.join(', ')}`);
      } else {
        console.log(`  [${elapsed}s] ${endpoint} returned status ${response.status}`);
      }
    } catch (error) {
      console.log(`  [${elapsed}s] Error checking governance data: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  throw new Error(`Timeout waiting for ${apiVersion} governance data confirmation after ${elapsed}s. Keys: [${keys.join(', ')}]`);
};

/**
 * Verify governance data via the CADT API GET endpoints.
 *
 * @param {Object} request - supertest instance
 * @param {string} apiVersion - 'v1' or 'v2'
 * @param {Object} expected - { pickList, glossary, orgList } expected data
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export const verifyGovernanceApiData = async (request, apiVersion, expected) => {
  const errors = [];

  console.log(`\nVerifying ${apiVersion} governance data via API:`);

  if (expected.pickList) {
    try {
      const response = await request.get(`/${apiVersion}/governance/meta/pickList`);
      if (response.status !== 200) {
        errors.push(`GET pickList returned status ${response.status}`);
      } else {
        const expectedKeys = Object.keys(expected.pickList).sort();
        const actualKeys = Object.keys(response.body).sort();

        if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
          errors.push(`pickList keys mismatch: expected [${expectedKeys.join(', ')}], got [${actualKeys.join(', ')}]`);
        } else {
          console.log(`  pickList: ${actualKeys.length} keys match`);
        }
      }
    } catch (error) {
      errors.push(`Error fetching pickList: ${error.message}`);
    }
  }

  if (expected.glossary) {
    try {
      const response = await request.get(`/${apiVersion}/governance/meta/glossary`);
      if (response.status !== 200) {
        errors.push(`GET glossary returned status ${response.status}`);
      } else {
        const expectedKeys = Object.keys(expected.glossary).sort();
        const actualKeys = Object.keys(response.body).sort();

        if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
          errors.push(`glossary keys mismatch: expected [${expectedKeys.join(', ')}], got [${actualKeys.join(', ')}]`);
        } else {
          console.log(`  glossary: ${actualKeys.length} keys match`);
        }
      }
    } catch (error) {
      errors.push(`Error fetching glossary: ${error.message}`);
    }
  }

  if (expected.orgList) {
    try {
      const response = await request.get(`/${apiVersion}/governance/meta/orgList`);
      if (response.status !== 200) {
        errors.push(`GET orgList returned status ${response.status}`);
      } else {
        const expectedStr = JSON.stringify(expected.orgList);
        const actualStr = JSON.stringify(response.body);

        if (expectedStr !== actualStr) {
          errors.push(`orgList mismatch: expected ${expectedStr}, got ${actualStr}`);
        } else {
          console.log(`  orgList: matches (${Array.isArray(response.body) ? response.body.length : 0} entries)`);
        }
      }
    } catch (error) {
      errors.push(`Error fetching orgList: ${error.message}`);
    }
  }

  const valid = errors.length === 0;
  if (valid) {
    console.log(`  All ${apiVersion} governance API data verified`);
  } else {
    console.log(`  ${apiVersion} governance API verification failed:`);
    errors.forEach(err => console.log(`    - ${err}`));
  }

  return { valid, errors };
};
