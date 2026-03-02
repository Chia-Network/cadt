import _ from 'lodash';

import { expect } from 'chai';
import supertest from 'supertest';

import app from '../../src/server';
import { Staging } from '../../src/models';
import { getConfig } from '../../src/utils/config-loader';

const { USE_SIMULATOR } = getConfig().APP;

export const resetStagingTable = async () => {
  await supertest(app).delete(`/v1/staging/clean`);
  const result = await supertest(app).get('/v1/staging');
  expect(result.body).to.deep.equal([]);
};

export const getLastCreatedStagingRecord = async () => {
  const result = await supertest(app).get('/v1/staging');
  expect(result.body).to.be.an('array');
  return _.last(result.body);
};

export const commitStagingRecords = async () => {
  const results = await supertest(app).post('/v1/staging/commit');

  expect(results.statusCode).to.equal(200);
  expect(results.body).to.deep.equal({
    message: 'Staging Table committing to full node',
    success: true,
  });

  return results;
};

/**
 * Smart polling function for V1 tests - commits staging records and waits for a condition to be met
 * @param {Function} checkFn - Async function that returns true when sync is complete
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Time between checks in ms (default: 5000)
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 10)
 * @param {string} options.description - Description for logging
 * @returns {Promise<Object>} The commit response
 */
export const commitStagingRecordsAndWaitForCondition = async (checkFn, options = {}) => {
  const defaultInterval = USE_SIMULATOR ? 500 : 5000;
  const defaultMaxAttempts = USE_SIMULATOR ? 30 : 10;
  const interval = options.interval || defaultInterval;
  const maxAttempts = options.maxAttempts || defaultMaxAttempts;
  const description = options.description || 'Sync operation';

  const preCommitCount = await Staging.count({ where: { commited: false } });
  console.log(`[TEST commitStagingRecordsAndWaitForCondition] BEFORE COMMIT: ${preCommitCount} uncommitted staging records`);

  const commitTime = Date.now();
  const response = await supertest(app).post('/v1/staging/commit');
  console.log(`[TEST commitStagingRecordsAndWaitForCondition] COMMIT API called at ${new Date(commitTime).toISOString()}, status: ${response.status}, description: "${description}"`);

  expect(response.statusCode).to.equal(200);
  expect(response.body).to.deep.equal({
    message: 'Staging Table committing to full node',
    success: true,
  });

  console.log(`[TEST commitStagingRecordsAndWaitForCondition] Waiting ${interval / 1000}s before first check...`);
  await new Promise(resolve => setTimeout(resolve, interval)); // Wait 5s before first check

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[TEST commitStagingRecordsAndWaitForCondition] Attempt ${attempt}/${maxAttempts}: Checking condition for "${description}"...`);
    const isComplete = await checkFn();
    if (isComplete) {
      const elapsedTime = Date.now() - commitTime;
      console.log(`[TEST commitStagingRecordsAndWaitForCondition] ✓ SUCCESS after ${elapsedTime}ms (${(elapsedTime/1000).toFixed(1)}s, ${attempt} attempts) - ${description}`);
      return response;
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  const elapsedTime = Date.now() - commitTime;
  throw new Error(
    `[TEST commitStagingRecordsAndWaitForCondition] ❌ FAILED after ${elapsedTime}ms (${(elapsedTime/1000).toFixed(1)}s, ${maxAttempts} attempts) - ${description} did not complete within max attempts.`
  );
};
