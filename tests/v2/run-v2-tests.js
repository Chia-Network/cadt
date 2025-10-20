#!/usr/bin/env node

/**
 * V2 Test Runner
 *
 * This script runs the comprehensive V2 test suite including:
 * - Resource tests for all 21 data tables
 * - Integration tests for staging and audit workflows
 * - Validation tests for error handling and data validation
 * - System table tests for organizations, meta, governance, and simulator
 *
 * Usage:
 *   npm run test:v2                    # Run all V2 tests
 *   npm run test:v2:resources          # Run only resource tests
 *   npm run test:v2:integration        # Run only integration tests
 *   npm run test:v2:validation         # Run only validation tests
 *   npm run test:v2:system             # Run only system tests
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testSuites = {
  resources: 'tests/v2/resources/*.spec.js',
  integration: 'tests/v2/integration/*.spec.js',
  validation: 'tests/v2/validation/*.spec.js',
  system: 'tests/v2/system/*.spec.js',
  all: 'tests/v2/**/*.spec.js',
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTests(testPattern, suiteName) {
  return new Promise((resolve, reject) => {
    log(`\n${colors.bright}Running V2 ${suiteName} tests...${colors.reset}`, 'cyan');
    log(`Pattern: ${testPattern}`, 'blue');

    const mocha = spawn('npx', ['mocha', testPattern, '--timeout', '30000'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });

    mocha.on('close', (code) => {
      if (code === 0) {
        log(`✅ V2 ${suiteName} tests passed!`, 'green');
        resolve();
      } else {
        log(`❌ V2 ${suiteName} tests failed with code ${code}`, 'red');
        reject(new Error(`Tests failed with code ${code}`));
      }
    });

    mocha.on('error', (error) => {
      log(`❌ Error running V2 ${suiteName} tests: ${error.message}`, 'red');
      reject(error);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const suite = args[0] || 'all';

  if (!testSuites[suite]) {
    log(`❌ Invalid test suite: ${suite}`, 'red');
    log(`Available suites: ${Object.keys(testSuites).join(', ')}`, 'yellow');
    process.exit(1);
  }

  try {
    log(`${colors.bright}🚀 Starting V2 Test Suite${colors.reset}`, 'magenta');
    log(`Suite: ${suite}`, 'blue');
    log(`Time: ${new Date().toISOString()}`, 'blue');

    if (suite === 'all') {
      // Run all test suites in sequence
      const suites = ['resources', 'integration', 'validation', 'system'];

      for (const testSuite of suites) {
        await runTests(testSuites[testSuite], testSuite);
      }

      log(`\n${colors.bright}🎉 All V2 tests completed successfully!${colors.reset}`, 'green');
    } else {
      // Run specific test suite
      await runTests(testSuites[suite], suite);
      log(`\n${colors.bright}🎉 V2 ${suite} tests completed successfully!${colors.reset}`, 'green');
    }

  } catch (error) {
    log(`\n${colors.bright}💥 V2 test suite failed: ${error.message}${colors.reset}`, 'red');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log(`\n${colors.bright}⚠️  Test suite interrupted${colors.reset}`, 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log(`\n${colors.bright}⚠️  Test suite terminated${colors.reset}`, 'yellow');
  process.exit(1);
});

main().catch((error) => {
  log(`\n${colors.bright}💥 Unexpected error: ${error.message}${colors.reset}`, 'red');
  process.exit(1);
});
