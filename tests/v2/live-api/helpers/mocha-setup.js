/**
 * Mocha setup file that runs once before all tests
 * This is loaded via --require flag in mocha
 */

import { runSharedSetup } from './shared-setup.js';

// Run shared setup before any tests
await runSharedSetup();
