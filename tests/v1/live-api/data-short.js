#!/usr/bin/env node
/**
 * Orchestration file for short test mode (batch commits)
 * Runs all POST requests first, then commits, then PUT requests, then commits, then DELETE requests, then commits
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test files ordered by dependency: projects before units (units reference projects via projectLocationId)
const testFiles = [
  'project-validation.live.spec.js',
  'unit-validation.live.spec.js',
  'staging-validation.live.spec.js',
];

async function runMochaTests(grepPattern, phaseName, filesToRun = null) {
  return new Promise((resolve, reject) => {
    const files = filesToRun || testFiles;
    const testPaths = files.map(f => join(__dirname, f));
    const args = [
      '--loader', 'node_modules/extensionless/src/register.js',
      '--require', join(__dirname, 'helpers/mocha-setup.js'),
      ...testPaths,
      '--grep', grepPattern,
      '--reporter', 'spec',
      '--timeout', '3600000',
      '--exit',
    ];

    const method = phaseName.includes('POST') ? 'POST' : phaseName.includes('PUT') ? 'PUT' : 'DELETE';
    // Skip empty database check for PUT and DELETE phases
    const skipEmptyCheck = method !== 'POST';
    const envArgs = skipEmptyCheck
      ? ['NODE_ENV=production', 'TEST_MODE=short', 'SKIP_EMPTY_CHECK=true']
      : ['NODE_ENV=production', 'TEST_MODE=short'];

    console.log(`\n=== Phase: ${phaseName} ===`);
    console.log(`Running tests matching: ${grepPattern}\n`);

    const mocha = spawn('npx', ['cross-env', ...envArgs, 'mocha', ...args], {
      stdio: 'inherit',
      shell: false,
    });

    mocha.on('close', async (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Mocha exited with code ${code}`));
      }
    });

    mocha.on('error', (error) => {
      reject(error);
    });
  });
}

async function commitAndWait(phase) {
  const { getLiveApiRequest, commitStagedRecords, waitForPendingCommits, waitForStagingEmpty, waitForBatchToAppear } = await import('./helpers/live-api-helpers.js');
  const { getAllCreatedIds, getBatchVerificationRecords, clearBatchVerificationRecords } = await import('./helpers/shared-state.js');

  const request = await getLiveApiRequest();

  // Check if staging table has records before committing
  const stagingResponse = await request.get('/v1/staging');
  const records = Array.isArray(stagingResponse.body) ? stagingResponse.body : (stagingResponse.body?.data || []);

  if (records.length === 0) {
    console.log(`\n=== No staged records to commit for ${phase} phase ===`);
    return;
  }

  console.log(`\n=== Committing all staged records for ${phase} phase ===`);
  await commitStagedRecords(request, [], true); // force = true
  await waitForPendingCommits(request);
  await waitForStagingEmpty(request);

  // Wait for all created records to appear after batch commit
  const recordsToWaitFor = getAllCreatedIds();
  if (recordsToWaitFor.length > 0) {
    const waitTimestamp = new Date().toISOString();
    console.log(`[${waitTimestamp}] Waiting for ${recordsToWaitFor.length} record(s) to appear after batch commit...`);
    request._forceWait = true;
    await waitForBatchToAppear(request, recordsToWaitFor);
    request._forceWait = false;
  }

  // Verify records
  const verificationRecords = getBatchVerificationRecords();
  const verifyTimestamp = new Date().toISOString();
  console.log(`[${verifyTimestamp}] Verifying ${phase} operations...`);

  const { validateDataInDatabase } = await import('./helpers/live-api-helpers.js');

  let verifiedCount = 0;
  let failedCount = 0;
  const failures = [];

  // Iterate through all tracked records by type
  for (const [type, records] of Object.entries(verificationRecords)) {
    for (const [id, recordInfo] of Object.entries(records)) {
      const { operation, expectedData } = recordInfo;

      try {
        if (operation === 'POST' || operation === 'PUT') {
          // Verify record exists and data matches
          const isValid = await validateDataInDatabase(request, type, id, expectedData || {});
          if (isValid) {
            verifiedCount++;
            console.log(`  ✓ Verified ${operation} ${type}/${id}`);
          } else {
            failedCount++;
            const errorMsg = `${operation} ${type}/${id}: Data mismatch`;
            failures.push(errorMsg);
            console.error(`  ❌ ${errorMsg}`);
          }
        } else if (operation === 'DELETE') {
          // Verify record does NOT exist
          try {
            let endpoint;
            if (type === 'project' || type === 'projects') {
              endpoint = `/v1/projects?warehouseProjectId=${id}`;
            } else if (type === 'unit' || type === 'units') {
              endpoint = `/v1/units?warehouseUnitId=${id}`;
            } else {
              throw new Error(`Unknown type: ${type}`);
            }

            const response = await request.get(endpoint);
            const data = response.body?.data || response.body;
            const records = Array.isArray(data) ? data : (data ? [data] : []);

            if (records.length === 0) {
              verifiedCount++;
              console.log(`  ✓ Verified DELETE ${type}/${id} (record not found as expected)`);
            } else {
              failedCount++;
              const errorMsg = `DELETE ${type}/${id}: Record still exists`;
              failures.push(errorMsg);
              console.error(`  ❌ ${errorMsg}`);
            }
          } catch (error) {
            // If GET fails with 404 or similar, that's good - record is deleted
            if (error.status === 404 || error.response?.status === 404) {
              verifiedCount++;
              console.log(`  ✓ Verified DELETE ${type}/${id} (record not found as expected)`);
            } else {
              // Some other error occurred
              failedCount++;
              const errorMsg = `DELETE ${type}/${id}: Error checking - ${error.message}`;
              failures.push(errorMsg);
              console.error(`  ❌ ${errorMsg}`);
            }
          }
        }
      } catch (error) {
        failedCount++;
        const errorMsg = `${operation} ${type}/${id}: ${error.message}`;
        failures.push(errorMsg);
        console.error(`  ❌ ${errorMsg}`);
      }
    }
  }

  if (failedCount > 0) {
    console.error(`\n❌ Verification failed: ${failedCount} record(s) failed verification`);
    console.error('Failures:');
    failures.forEach(failure => console.error(`  - ${failure}`));
    throw new Error(`Verification failed: ${failedCount} of ${verifiedCount + failedCount} record(s) failed`);
  } else if (verifiedCount > 0) {
    console.log(`✓ Verified ${verifiedCount} record(s) successfully`);
  } else {
    console.log('No records to verify');
  }

  clearBatchVerificationRecords();
  console.log(`[${verifyTimestamp}] ✓ ${phase} phase complete\n`);
}

async function main() {
  try {
    console.log('\n=== Short Test Mode (Batch Commits) ===\n');

    // Clear staging table and verification state before starting tests
    const { getLiveApiRequest, clearStagingTable } = await import('./helpers/live-api-helpers.js');
    const { clearVerificationState } = await import('./helpers/verification-state.js');
    const request = await getLiveApiRequest();
    console.log('Clearing staging table before tests...');
    await clearStagingTable(request);
    clearVerificationState(); // Clear any previous verification state
    console.log('');

    // Phase 0: Validation Failure Tests
    await runMochaTests('Step 3: Validation Failure Tests', 'Validation Failures');
    console.log('Clearing staging table after validation failure tests...');
    await clearStagingTable(request);
    console.log('');

    // Phase 1: POST tests
    await runMochaTests('Step 4: POST Request Tests', 'POST Operations');
    await commitAndWait('POST');

    // Phase 2: PUT tests
    await runMochaTests('Step 7: PUT Request Tests', 'PUT Operations');
    await commitAndWait('PUT');

    // Phase 3: DELETE tests
    await runMochaTests('Step 9: DELETE Request Tests', 'DELETE Operations');
    await commitAndWait('DELETE');

    console.log('\n=== All phases complete ===\n');
  } catch (error) {
    console.error('Error running short mode tests:', error);
    process.exit(1);
  }
}

main();
