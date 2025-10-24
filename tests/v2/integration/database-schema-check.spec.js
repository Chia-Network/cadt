import { expect } from 'chai';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { sequelizeV2 } from '../../../src/database/v2/index.js';

describe('Database Schema Check', function () {
  this.timeout(30000);

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();
  });

  after(async function () {
    console.log('Cleaning up V2 test environment...');
    // Cleanup handled by test framework
  });

  it('should show actual database schema', async function () {
    // Check program table schema
    const [programResults] = await sequelizeV2.query(`PRAGMA table_info(program)`);
    console.log('\nProgram table schema:');
    programResults.forEach(col => {
      console.log(`  ${col.name}: ${col.type} (pk: ${col.pk}, notnull: ${col.notnull})`);
    });

    // Check methodology table schema
    const [methodologyResults] = await sequelizeV2.query(`PRAGMA table_info(methodology)`);
    console.log('\nMethodology table schema:');
    methodologyResults.forEach(col => {
      console.log(`  ${col.name}: ${col.type} (pk: ${col.pk}, notnull: ${col.notnull})`);
    });

    // Check project table schema
    const [projectResults] = await sequelizeV2.query(`PRAGMA table_info(project)`);
    console.log('\nProject table schema:');
    projectResults.forEach(col => {
      console.log(`  ${col.name}: ${col.type} (pk: ${col.pk}, notnull: ${col.notnull})`);
    });

    // This test always passes - it's just for debugging
    expect(true).to.be.true;
  });
});
