#!/usr/bin/env node
/**
 * Orchestration file for extended test mode (commit after each endpoint)
 * Runs tests normally - each test file handles its own commits
 * This is essentially just running all test files in sequence with TEST_MODE=extended
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

  // XLSX import/export tests (runs after all base entities exist)
  'xlsx-import-export.live.spec.js',
];

async function main() {
  // Note: Shared setup runs via --require flag in mocha, so it executes once before all tests

  return new Promise((resolve, reject) => {
    const testPaths = testFiles.map(f => join(__dirname, f));
    const args = [
      '--loader', 'node_modules/extensionless/src/register.js',
      '--require', join(__dirname, 'helpers/mocha-setup.js'),
      ...testPaths,
      '--reporter', 'spec',
      '--timeout', '1800000',
      '--exit',
    ];

    console.log('\n=== Extended Test Mode (Commit Per Endpoint) ===\n');

    const mocha = spawn('npx', ['cross-env', 'NODE_ENV=production', 'TEST_MODE=extended', 'mocha', ...args], {
      stdio: 'inherit',
      shell: false,
    });

    mocha.on('close', (code) => {
      if (code === 0) {
        console.log('\n=== All tests complete ===\n');
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

main().catch(error => {
  console.error('Error running extended mode tests:', error);
  process.exit(1);
});
