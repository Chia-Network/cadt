import { prepareV2Db } from '../src/database/v2/index.js';
import { sequelizeV2 } from '../src/database/v2/index.js';

async function checkDatabaseSchema() {
  console.log('Checking V2 database schema...');

  try {
    await prepareV2Db();

    // Check program table schema
    const [results] = await sequelizeV2.query(`PRAGMA table_info(program)`);
    console.log('Program table schema:');
    results.forEach(col => {
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

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await sequelizeV2.close();
  }
}

checkDatabaseSchema().then(() => {
  console.log('Schema check completed');
  process.exit(0);
}).catch((error) => {
  console.error('Schema check failed:', error);
  process.exit(1);
});
