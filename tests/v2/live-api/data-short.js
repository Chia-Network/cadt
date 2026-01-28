#!/usr/bin/env node
/**
 * Orchestration file for short test mode (batch commits)
 * Runs all POST requests first, then commits, then PUT requests, then commits, then DELETE requests, then commits
 * Based on run-batched-tests.js but adapted for new structure
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test files ordered by dependency: prerequisites must come before dependents
// Order matches natural user workflow: create base entities first, then relationships
const testFiles = [
  // Base entities (no dependencies)
  'methodology-validation.live.spec.js',      // No deps
  'program-validation.live.spec.js',         // No deps
  'stakeholder-validation.live.spec.js',      // No deps
  'label-validation.live.spec.js',           // No deps

  // Project and its direct dependents
  'project-validation.live.spec.js',         // Needs program (optional)
  'location-validation.live.spec.js',        // Needs project
  'estimation-validation.live.spec.js',      // Needs project
  'rating-validation.live.spec.js',          // Needs project
  'co-benefit-validation.live.spec.js',      // Needs project
  'validation-validation.live.spec.js',      // Needs project

  // Verification and its dependents
  'verification-validation.live.spec.js',     // Needs project, optionally validation
  'issuance-validation.live.spec.js',        // Needs verification + methodology
  'unit-validation.live.spec.js',            // Needs issuance

  // Relationship tables (composite keys)
  'project-methodology-validation.live.spec.js',  // Needs project + methodology
  'stakeholder-projects-validation.live.spec.js',  // Needs stakeholder + project
  'unit-label-validation.live.spec.js',            // Needs unit + label

  // AEF endpoints (need to check dependencies)
  'aef-t1-submission-validation.live.spec.js',
  'aef-t2-authorizations-validation.live.spec.js',
  'aef-t3-actions-validation.live.spec.js',
  'aef-t4-holdings-validation.live.spec.js',
  'aef-t5-authorized-entities-validation.live.spec.js',
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

// Map camelCase type names to kebab-case API endpoint paths
const TYPE_TO_ENDPOINT = {
  coBenefit: 'co-benefit',
  'co-benefit': 'co-benefit',
  projectMethodology: 'project-methodology',
  'project-methodology': 'project-methodology',
  stakeholderProjects: 'stakeholder-projects',
  'stakeholder-projects': 'stakeholder-projects',
  unitLabel: 'unit-label',
  'unit-label': 'unit-label',
  aefT1Submission: 'aef-t1-submission',
  'aef-t1-submission': 'aef-t1-submission',
  aefT2Authorizations: 'aef-t2-authorizations',
  'aef-t2-authorizations': 'aef-t2-authorizations',
  aefT3Actions: 'aef-t3-actions',
  'aef-t3-actions': 'aef-t3-actions',
  aefT4Holdings: 'aef-t4-holdings',
  'aef-t4-holdings': 'aef-t4-holdings',
  aefT5AuthorizedEntities: 'aef-t5-authorized-entities',
  'aef-t5-authorized-entities': 'aef-t5-authorized-entities',
};

/**
 * Convert type name to API endpoint path
 * @param {string} type - Type name (camelCase or kebab-case)
 * @returns {string} - Endpoint path (kebab-case)
 */
function getEndpointPath(type) {
  return TYPE_TO_ENDPOINT[type] || type;
}

async function commitAndWait(phase) {
  const { getLiveApiRequest, commitStagedRecords, waitForPendingCommits, waitForStagingEmpty, waitForBatchToAppear, validateDataInDatabase } = await import('./helpers/live-api-helpers.js');
  const { getAllCreatedIds, getBatchVerificationRecords, clearBatchVerificationRecords } = await import('./helpers/shared-state.js');

  // Use V2 API version for health checks since this uses V2 endpoints
  const request = await getLiveApiRequest({ apiVersion: 'v2' });

  // Check if staging table has records before committing
  const stagingResponse = await request.get('/v2/staging');
  const records = Array.isArray(stagingResponse.body) ? stagingResponse.body : (stagingResponse.body?.data || []);

  if (records.length === 0) {
    console.log(`\n=== No staged records to commit for ${phase} phase ===`);
    clearBatchVerificationRecords(); // Still clear verification records
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

  let verifiedCount = 0;
  let failedCount = 0;
  const failures = [];

  // Iterate through all tracked records by type
  for (const [type, typeRecords] of Object.entries(verificationRecords)) {
    const endpointPath = getEndpointPath(type);

    for (const [id, recordInfo] of Object.entries(typeRecords)) {
      const { operation, expectedData } = recordInfo;

      try {
        if (operation === 'POST' || operation === 'PUT') {
          // Verify record exists and data matches
          const isValid = await validateDataInDatabase(request, endpointPath, id, expectedData || {});
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
            // V2 uses direct ID in path with correct endpoint
            const endpoint = `/v2/${endpointPath}/${id}`;
            const response = await request.get(endpoint);

            // If we get here without error and status is 200, record still exists
            if (response.status === 200 && response.body) {
              failedCount++;
              const errorMsg = `DELETE ${type}/${id}: Record still exists`;
              failures.push(errorMsg);
              console.error(`  ❌ ${errorMsg}`);
            } else {
              verifiedCount++;
              console.log(`  ✓ Verified DELETE ${type}/${id} (record not found as expected)`);
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

// Test files that have no dependencies (can validate without parent records)
const baseTestFiles = [
  'methodology-validation.live.spec.js',
  'program-validation.live.spec.js',
  'stakeholder-validation.live.spec.js',
  'label-validation.live.spec.js',
  'project-validation.live.spec.js',
  // AEF endpoints (no parent dependencies)
  'aef-t1-submission-validation.live.spec.js',
  'aef-t2-authorizations-validation.live.spec.js',
  'aef-t5-authorized-entities-validation.live.spec.js',
];

// Test files that depend on parent records existing
const childTestFiles = [
  'location-validation.live.spec.js',        // Needs project
  'estimation-validation.live.spec.js',      // Needs project
  'rating-validation.live.spec.js',          // Needs project
  'co-benefit-validation.live.spec.js',      // Needs project
  'validation-validation.live.spec.js',      // Needs project
  'verification-validation.live.spec.js',     // Needs project
  'issuance-validation.live.spec.js',        // Needs verification + methodology
  'unit-validation.live.spec.js',            // Needs issuance
  'project-methodology-validation.live.spec.js',  // Needs project + methodology
  'stakeholder-projects-validation.live.spec.js',  // Needs stakeholder + project
  'unit-label-validation.live.spec.js',            // Needs unit + label
  'aef-t3-actions-validation.live.spec.js',        // Needs aef-t2
  'aef-t4-holdings-validation.live.spec.js',       // Needs aef-t2
];

async function main() {
  try {
    console.log('\n=== Short Test Mode (Batch Commits) ===\n');

    // Clear staging table and ALL shared state before starting tests
    const { getLiveApiRequest, clearStagingTable } = await import('./helpers/live-api-helpers.js');
    const { clearAllState } = await import('./helpers/verification-state.js');
    // Use V2 API version for health checks since this uses V2 endpoints
    const request = await getLiveApiRequest({ apiVersion: 'v2' });
    console.log('Clearing staging table before tests...');
    await clearStagingTable(request);
    // Clear ALL shared state (verification records AND created IDs) for fresh test run
    clearAllState();
    console.log('✓ Cleared all shared state for fresh test run');
    console.log('');

    // Phase 1: Validation Failures for BASE entities (no parent dependencies)
    console.log('--- Running validation failures for base entities ---');
    await runMochaTests('Step 3: Validation Failure Tests', 'Base Validation Failures', baseTestFiles);
    console.log('Clearing staging table after base validation failure tests...');
    await clearStagingTable(request);
    console.log('');

    // Phase 2: POST tests for ALL entities (creates parent records)
    await runMochaTests('Step 4: POST Request Tests', 'POST Operations');
    await commitAndWait('POST');

    // Phase 3: Validation Failures for CHILD entities (now parent records exist)
    console.log('--- Running validation failures for child entities ---');
    await runMochaTests('Step 3: Validation Failure Tests', 'Child Validation Failures', childTestFiles);
    console.log('Clearing staging table after child validation failure tests...');
    await clearStagingTable(request);
    console.log('');

    // Phase 4: PUT tests
    await runMochaTests('Step 7: PUT Request Tests', 'PUT Operations');
    await commitAndWait('PUT');

    // Phase 5: DELETE tests
    await runMochaTests('Step 9: DELETE Request Tests', 'DELETE Operations');
    await commitAndWait('DELETE');

    console.log('\n=== All phases complete ===\n');
  } catch (error) {
    console.error('Error running short mode tests:', error);
    process.exit(1);
  }
}

main();
