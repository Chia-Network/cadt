import { sequelizeV2 } from '../src/database/v2/index.js';
import { migrations } from '../src/database/v2/migrations/index.js';

async function forceRecreateV2Tables() {
  console.log('Force recreating V2 data tables with UUID primary keys...');

  try {
    // Drop all data tables (not system tables)
    const dataTables = [
      'location', 'unit', 'issuance', 'verification', 'validation',
      'project', 'program', 'methodology'
    ];

    for (const tableName of dataTables) {
      try {
        await sequelizeV2.query(`DROP TABLE IF EXISTS ${tableName};`);
        console.log(`Dropped table: ${tableName}`);
      } catch (error) {
        console.log(`Table ${tableName} may not exist:`, error.message);
      }
    }

    // Remove migration records for data tables
    for (const migration of migrations) {
      if (dataTables.some(table => migration.name.includes(table))) {
        try {
          await sequelizeV2.query(
            'DELETE FROM SequelizeMetaV2 WHERE name = :name',
            { replacements: { name: migration.name } }
          );
          console.log(`Removed migration record: ${migration.name}`);
        } catch (error) {
          console.log(`Migration record ${migration.name} may not exist:`, error.message);
        }
      }
    }

    // Recreate tables using migrations
    for (const migration of migrations) {
      if (dataTables.some(table => migration.name.includes(table))) {
        try {
          console.log(`Running migration: ${migration.name}`);
          await migration.migration.up(sequelizeV2.getQueryInterface(), sequelizeV2.Sequelize);
          await sequelizeV2.query('INSERT INTO SequelizeMetaV2 (name) VALUES(:name)', {
            replacements: { name: migration.name }
          });
          console.log(`Completed migration: ${migration.name}`);
        } catch (error) {
          console.error(`Error running migration ${migration.name}:`, error.message);
        }
      }
    }

    console.log('V2 data tables recreated successfully with UUID primary keys!');

  } catch (error) {
    console.error('Error force recreating V2 tables:', error);
  } finally {
    await sequelizeV2.close();
  }
}

// Run the function
forceRecreateV2Tables().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
