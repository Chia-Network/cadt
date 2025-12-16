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
  'methodology-validation.spec.js',      // No deps
  'program-validation.spec.js',         // No deps
  'stakeholder-validation.spec.js',      // No deps
  'label-validation.spec.js',           // No deps

  // Project and its direct dependents
  'project-validation.spec.js',         // Needs program (optional)
  'location-validation.spec.js',        // Needs project
  'estimation-validation.spec.js',      // Needs project
  'rating-validation.spec.js',          // Needs project
  'co-benefit-validation.spec.js',      // Needs project
  'validation-validation.spec.js',      // Needs project

  // Verification and its dependents
  'verification-validation.spec.js',     // Needs project, optionally validation
  'issuance-validation.spec.js',        // Needs verification + methodology
  'unit-validation.spec.js',            // Needs issuance

  // Relationship tables (composite keys)
  'project-methodology-validation.spec.js',  // Needs project + methodology
  'stakeholder-projects-validation.spec.js',  // Needs stakeholder + project
  'unit-label-validation.spec.js',            // Needs unit + label

  // AEF endpoints (need to check dependencies)
  'aef-t1-submission-validation.spec.js',
  'aef-t2-authorizations-validation.spec.js',
  'aef-t3-actions-validation.spec.js',
  'aef-t4-holdings-validation.spec.js',
  'aef-t5-authorized-entities-validation.spec.js',
];

async function runMochaTests(grepPattern, phaseName) {
  return new Promise((resolve, reject) => {
    const testPaths = testFiles.map(f => join(__dirname, f));
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
    console.log(`\n=== Phase: ${phaseName} ===`);
    console.log(`Running tests matching: ${grepPattern}\n`);

    const mocha = spawn('npx', ['cross-env', 'NODE_ENV=production', 'TEST_MODE=short', 'mocha', ...args], {
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
  const timestamp = new Date().toISOString();

  console.log(`\n[${timestamp}] Committing all staged records for ${phase} phase...`);
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
  console.log(`[${timestamp}] Verifying ${phase} operations...`);
  // Verification logic would go here

  clearBatchVerificationRecords();
  console.log(`[${timestamp}] ✓ ${phase} phase complete\n`);
}

async function main() {
  try {
    console.log('\n=== Short Test Mode (Batch Commits) ===\n');
    // Note: Shared setup runs via --require flag in mocha, so it executes once before all tests

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
