#!/usr/bin/env node
/**
 * Utility to run only POST request tests without committing staging records
 * Useful for testing POST endpoints without actually committing data to datalayer
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get parent directory (tests/v2/live-api)
const liveApiDir = join(__dirname, '..');

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

async function runPostTests() {
  return new Promise((resolve, reject) => {
    // Only run tests for the first 16 endpoints in the list
    const firstSixteenTestFiles = testFiles.slice(0, 16);
    const testPaths = firstSixteenTestFiles.map(f => join(liveApiDir, f));
    const args = [
      '--loader', 'node_modules/extensionless/src/register.js',
      '--require', join(liveApiDir, 'helpers/mocha-setup.js'),
      ...testPaths,
      '--grep', 'Step 4: POST Request Tests',
      '--reporter', 'spec',
      '--timeout', '3600000',
      '--exit',
    ];

    console.log(`\n=== Running POST Request Tests Only (No Commits) ===`);
    console.log(`=== Testing: ${firstSixteenTestFiles.join(', ')} ===\n`);

    // Use TEST_MODE=short to prevent auto-commits, but we won't call commitAndWait
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

async function main() {
  try {
    console.log('\n=== POST Only Test Mode (No Commits) ===\n');

    // Clear staging table before starting tests
    const { getLiveApiRequest, clearStagingTable } = await import('../helpers/live-api-helpers.js');
    // Use V2 API version for health checks since this uses V2 endpoints
    const request = await getLiveApiRequest({ apiVersion: 'v2' });
    console.log('Clearing staging table before tests...');
    await clearStagingTable(request);
    console.log('✓ Staging table cleared\n');

    // Note: Shared setup runs via --require flag in mocha, so it executes once before all tests

    // Run POST tests only (no commits)
    await runPostTests();

    console.log('\n=== POST tests complete (staging records NOT committed) ===\n');
    console.log('Note: All POST requests created staging records, but no commits were performed.');
    console.log('Use POST /v2/staging/commit to commit when ready, or DELETE /v2/staging/clean to clear.\n');
  } catch (error) {
    console.error('Error running POST only tests:', error);
    process.exit(1);
  }
}

main();
