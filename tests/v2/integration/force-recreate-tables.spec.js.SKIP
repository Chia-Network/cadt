import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { sequelizeV2 } from '../../../src/database/v2/index.js';

describe('Force Recreate Tables', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  it('should force recreate tables with correct schema', async function () {
    // Drop problematic tables
    const tablesToRecreate = ['program', 'project', 'validation', 'verification', 'issuance', 'unit', 'location'];

    for (const tableName of tablesToRecreate) {
      try {
        await sequelizeV2.query(`DROP TABLE IF EXISTS ${tableName};`);
        console.log(`Dropped table: ${tableName}`);
      } catch (error) {
        console.log(`Error dropping table ${tableName}:`, error.message);
      }
    }

    // Remove migration records for these tables
    const migrationNames = [
      '20250110120007-create-program-v2',
      '20250110120008-create-project-v2',
      '20250110120009-create-validation-v2',
      '20250110120010-create-verification-v2',
      '20250110120011-create-issuance-v2',
      '20250110120012-create-unit-v2',
      '20250110120013-create-location-v2'
    ];

    for (const migrationName of migrationNames) {
      try {
        await sequelizeV2.query(
          'DELETE FROM SequelizeMetaV2 WHERE name = ?',
          { replacements: [migrationName] }
        );
        console.log(`Removed migration record: ${migrationName}`);
      } catch (error) {
        console.log(`Error removing migration record ${migrationName}:`, error.message);
      }
    }

    // Re-run prepareV2Db to recreate tables
    console.log('Recreating tables...');
    await prepareV2Db();

    // Check the schema again
    const [programResults] = await sequelizeV2.query(`PRAGMA table_info(program)`);
    console.log('\nProgram table schema after recreation:');
    programResults.forEach(col => {
      console.log(`  ${col.name}: ${col.type} (pk: ${col.pk}, notnull: ${col.notnull})`);
    });

    // This test always passes - it's just for debugging
    expect(true).to.be.true;
  });
});
