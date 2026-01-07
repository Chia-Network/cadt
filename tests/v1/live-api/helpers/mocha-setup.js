/**
 * Mocha setup file that runs once before all tests
 * This is loaded via --require flag in mocha
 */

import { runSharedSetup } from './shared-setup.js';

// Check if we should skip empty database check (for PUT/DELETE phases)
const skipEmptyCheck = process.env.SKIP_EMPTY_CHECK === 'true';

// Run shared setup before any tests
await runSharedSetup(skipEmptyCheck);
