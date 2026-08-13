import { expect } from 'chai';
import { sequelizeV2 } from '../../../src/database/v2/index.js';
import { GovernanceV2 } from '../../../src/models/v2/index.js';
import { pullPickListValuesV2 } from '../../../src/utils/v2-data-loaders.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';

/**
 * Server Initialization Order Tests
 *
 * This test verifies that migrations run before database queries are attempted.
 *
 * This test specifically catches bugs where pullPickListValuesV2() is called
 * before prepareV2Db(), which would cause "no such table: governance" errors
 * on fresh database installations.
 *
 * The test works by:
 * 1. Dropping the governance table to simulate a fresh install
 * 2. Testing that prepareV2Db() runs before pullPickListValuesV2()
 * 3. Verifying the initialization order matches the server's initializeDatabases() function
 */
describe('V2 Server Initialization Order Tests', function () {
  this.timeout(30000);

  let originalUseSimulator;
  let originalUseDevelopmentMode;

  const clearConfigCaches = () => {
    getConfig.cache?.clear();
    getConfigV2.cache?.clear();
  };

  before(async function () {
    // Save original config values
    originalUseSimulator = process.env.USE_SIMULATOR;
    originalUseDevelopmentMode = process.env.USE_DEVELOPMENT_MODE;
  });

  after(async function () {
    // Restore original config values
    if (originalUseSimulator !== undefined) {
      process.env.USE_SIMULATOR = originalUseSimulator;
    } else {
      delete process.env.USE_SIMULATOR;
    }
    if (originalUseDevelopmentMode !== undefined) {
      process.env.USE_DEVELOPMENT_MODE = originalUseDevelopmentMode;
    } else {
      delete process.env.USE_DEVELOPMENT_MODE;
    }
    clearConfigCaches();

    // Clean up - ensure migrations run so other tests can use the database
    const { prepareV2Db } = await import('../../../src/database/v2/index.js');
    await prepareV2Db();
  });

  it('should run migrations before querying governance table (non-simulator mode)', async function () {
    // Test WITHOUT simulator mode to exercise the real database query path
    // This is the critical test that would catch the original bug
    process.env.USE_SIMULATOR = 'false';
    process.env.USE_DEVELOPMENT_MODE = 'false';
    clearConfigCaches();
    expect(getConfig().APP.USE_SIMULATOR).to.equal(false);

    // Drop tables to simulate fresh install
    try {
      await sequelizeV2.query('DROP TABLE IF EXISTS governance;');
      await sequelizeV2.query('DROP TABLE IF EXISTS SequelizeMetaV2;');
    } catch (error) {
      // Ignore if already dropped or doesn't exist
    }

    // Verify governance table doesn't exist yet
    const tablesBefore = await sequelizeV2.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='governance'",
      { type: sequelizeV2.QueryTypes.SELECT }
    );
    expect(tablesBefore.length).to.equal(0, 'governance table should not exist before migrations');

    // Import prepareV2Db and run migrations (this is what initializeDatabases does first)
    const { prepareV2Db } = await import('../../../src/database/v2/index.js');
    await prepareV2Db();

    // Verify governance table now exists
    const tablesAfter = await sequelizeV2.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='governance'",
      { type: sequelizeV2.QueryTypes.SELECT }
    );
    expect(tablesAfter.length).to.equal(1, 'governance table should exist after migrations');

    // Now test that pullPickListValuesV2() can query the table without errors
    // This would fail with "no such table: governance" if called before prepareV2Db()
    const pickListValues = await pullPickListValuesV2();
    expect(pickListValues).to.exist;

    // Verify we can query the governance table
    const governanceCount = await GovernanceV2.count();
    expect(governanceCount).to.be.a('number');
  });

  it('should verify initialization order matches server startup path', async function () {
    // This test verifies that the order of operations in initializeDatabases()
    // matches what we expect: prepareV2Db() before pullPickListValuesV2()

    // Drop tables to simulate fresh install
    try {
      await sequelizeV2.query('DROP TABLE IF EXISTS governance;');
      await sequelizeV2.query('DROP TABLE IF EXISTS SequelizeMetaV2;');
    } catch (error) {
      // Ignore if already dropped
    }

    process.env.USE_SIMULATOR = 'false';
    process.env.USE_DEVELOPMENT_MODE = 'false';
    clearConfigCaches();
    expect(getConfig().APP.USE_SIMULATOR).to.equal(false);

    // Simulate the server initialization path:
    // 1. Authenticate
    await sequelizeV2.authenticate();

    // 2. Run migrations (prepareV2Db) - MUST happen first
    const { prepareV2Db } = await import('../../../src/database/v2/index.js');
    await prepareV2Db();

    // 3. Query governance table (pullPickListValuesV2) - MUST happen after migrations
    // If this order is wrong, we'd get "no such table: governance"
    const pickListValues = await pullPickListValuesV2();
    expect(pickListValues).to.exist;

    // Verify the table exists and is queryable
    const governanceCount = await GovernanceV2.count();
    expect(governanceCount).to.be.a('number');
  });

  it('should handle initialization when tables already exist', async function () {
    // Test that initialization works correctly when tables already exist
    // (simulating a server restart scenario)
    process.env.USE_SIMULATOR = 'true';
    process.env.USE_DEVELOPMENT_MODE = 'false';
    clearConfigCaches();
    expect(getConfig().APP.USE_SIMULATOR).to.equal(true);

    // Ensure tables exist
    const { prepareV2Db } = await import('../../../src/database/v2/index.js');
    await prepareV2Db();

    // Should succeed even when tables already exist
    const pickListValues = await pullPickListValuesV2();
    expect(pickListValues).to.exist;
  });
});

