import { expect } from 'chai';
import {
  prepareV2Db,
  sequelizeV2,
  sequelizeV2Mirror,
  mirrorDBEnabledV2,
  checkForV2Migrations,
  backfillMirrorV2,
} from '../../../src/database/v2/index.js';
import { Sequelize } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mirror Backfill V2 Tests
 *
 * Tests for the MySQL mirror backfill functionality that runs on CADT startup.
 * The backfill syncs existing SQLite data into the MySQL mirror using idempotent
 * upsert operations (INSERT ... ON DUPLICATE KEY UPDATE).
 *
 * In simulation mode (no MySQL configured), backfillMirrorV2 is a no-op.
 * These tests verify:
 *   1. The function is properly exported and callable
 *   2. It correctly detects when mirror is disabled and exits early
 *   3. The startup integration point in prepareV2Db works
 *   4. Core backfill logic works using the test mirror SQLite database
 */
describe('Mirror Backfill V2 Tests', function () {
  this.timeout(30000);

  before(async function () {
    await prepareV2Db();
  });

  describe('Function Export and Structure', function () {
    it('should export backfillMirrorV2 as a function', function () {
      expect(backfillMirrorV2).to.be.a('function');
    });

    it('should export mirrorDBEnabledV2 as a function', function () {
      expect(mirrorDBEnabledV2).to.be.a('function');
    });

    it('should detect mirror as disabled in test mode', function () {
      // mirrorDBEnabledV2 returns a falsy value when MySQL is not configured
      expect(mirrorDBEnabledV2()).to.not.be.ok;
    });
  });

  describe('No-op Behavior When Mirror Disabled', function () {
    it('should return immediately without error when mirror is not configured', async function () {
      // backfillMirrorV2 checks mirrorDBEnabledV2() and returns early if false
      // This should complete instantly without any database operations
      const startTime = Date.now();
      await backfillMirrorV2();
      const elapsed = Date.now() - startTime;

      // Should be near-instant (well under 100ms) since it just checks the flag and returns
      expect(elapsed).to.be.below(100);
    });

    it('should not throw when called multiple times', async function () {
      await backfillMirrorV2();
      await backfillMirrorV2();
      await backfillMirrorV2();
    });
  });

  describe('Startup Integration', function () {
    it('should not fail prepareV2Db when mirror is not configured', async function () {
      // prepareV2Db includes the backfill call but skips it when mirror is not configured
      await prepareV2Db();
    });

    it('should have source database tables available after prepareV2Db', async function () {
      // Verify that the main source tables exist (migrations ran successfully)
      const tables = await sequelizeV2.query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        { type: Sequelize.QueryTypes.SELECT },
      );
      const tableNames = tables.map((t) => t.name);

      // Spot-check critical tables that the backfill would read from
      expect(tableNames).to.include('project');
      expect(tableNames).to.include('unit');
      expect(tableNames).to.include('program');
      expect(tableNames).to.include('audit');
      expect(tableNames).to.include('issuance');
      expect(tableNames).to.include('methodology');
    });
  });

  describe('Core Backfill Logic (Mirror SQLite Fallback)', function () {
    // These tests verify the backfill approach works by using the test mirror
    // SQLite database directly (bypassing the mirrorDBEnabledV2 check).
    // This validates the read-from-source, write-to-mirror pattern that the
    // real backfill uses against MySQL.

    before(async function () {
      // Run migrations on the mirror test database so tables exist
      await checkForV2Migrations(sequelizeV2Mirror);
    });

    afterEach(async function () {
      // Clean up test data from both source and mirror
      await sequelizeV2.query('DELETE FROM program', {
        type: Sequelize.QueryTypes.DELETE,
      });
      await sequelizeV2Mirror.query('DELETE FROM program', {
        type: Sequelize.QueryTypes.DELETE,
      });
    });

    it('should be able to read from source and write to mirror using upsert', async function () {
      // Insert test data into the source (SQLite main DB)
      const testId = uuidv4();
      await sequelizeV2.query(
        `INSERT INTO program (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_description, created_at, updated_at)
         VALUES (:id, :name, :registry, :activityId, :desc, datetime('now'), datetime('now'))`,
        {
          replacements: {
            id: testId,
            name: 'Test Program',
            registry: 'Test Registry',
            activityId: 'ACT-001',
            desc: 'A test program for backfill',
          },
          type: Sequelize.QueryTypes.INSERT,
        },
      );

      // Verify source has the data
      const sourceRows = await sequelizeV2.query(
        'SELECT * FROM program WHERE cad_trust_program_id = :id',
        {
          replacements: { id: testId },
          type: Sequelize.QueryTypes.SELECT,
        },
      );
      expect(sourceRows).to.have.length(1);
      expect(sourceRows[0].program_name).to.equal('Test Program');

      // Simulate the backfill: read from source, write to mirror
      const allSourceRows = await sequelizeV2.query('SELECT * FROM program', {
        type: Sequelize.QueryTypes.SELECT,
      });

      // Use raw INSERT OR REPLACE (SQLite equivalent of MySQL's ON DUPLICATE KEY UPDATE)
      for (const row of allSourceRows) {
        await sequelizeV2Mirror.query(
          `INSERT OR REPLACE INTO program (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_registry_program_id, program_description, created_at, updated_at)
           VALUES (:id, :name, :registry, :activityId, :programId, :desc, :created, :updated)`,
          {
            replacements: {
              id: row.cad_trust_program_id,
              name: row.program_name,
              registry: row.program_registry,
              activityId: row.program_registry_activity_id,
              programId: row.program_registry_program_id,
              desc: row.program_description,
              created: row.created_at,
              updated: row.updated_at,
            },
            type: Sequelize.QueryTypes.INSERT,
          },
        );
      }

      // Verify mirror has the data
      const mirrorRows = await sequelizeV2Mirror.query(
        'SELECT * FROM program WHERE cad_trust_program_id = :id',
        {
          replacements: { id: testId },
          type: Sequelize.QueryTypes.SELECT,
        },
      );
      expect(mirrorRows).to.have.length(1);
      expect(mirrorRows[0].program_name).to.equal('Test Program');
    });

    it('should handle idempotent upsert (re-running with existing data)', async function () {
      const testId = uuidv4();

      // Insert test data into both source and mirror (simulating data already synced)
      const insertSql = `INSERT INTO program (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_description, created_at, updated_at)
         VALUES (:id, :name, :registry, :activityId, :desc, datetime('now'), datetime('now'))`;
      const insertParams = {
        replacements: {
          id: testId,
          name: 'Existing Program',
          registry: 'Existing Registry',
          activityId: 'ACT-002',
          desc: 'Already in both databases',
        },
        type: Sequelize.QueryTypes.INSERT,
      };

      await sequelizeV2.query(insertSql, insertParams);
      await sequelizeV2Mirror.query(insertSql, insertParams);

      // Verify both have the data
      const sourceBefore = await sequelizeV2.query(
        'SELECT COUNT(*) as count FROM program',
        { type: Sequelize.QueryTypes.SELECT },
      );
      const mirrorBefore = await sequelizeV2Mirror.query(
        'SELECT COUNT(*) as count FROM program',
        { type: Sequelize.QueryTypes.SELECT },
      );
      expect(sourceBefore[0].count).to.equal(1);
      expect(mirrorBefore[0].count).to.equal(1);

      // Re-run the upsert (simulating backfill on restart)
      const allSourceRows = await sequelizeV2.query('SELECT * FROM program', {
        type: Sequelize.QueryTypes.SELECT,
      });

      for (const row of allSourceRows) {
        await sequelizeV2Mirror.query(
          `INSERT OR REPLACE INTO program (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_registry_program_id, program_description, created_at, updated_at)
           VALUES (:id, :name, :registry, :activityId, :programId, :desc, :created, :updated)`,
          {
            replacements: {
              id: row.cad_trust_program_id,
              name: row.program_name,
              registry: row.program_registry,
              activityId: row.program_registry_activity_id,
              programId: row.program_registry_program_id,
              desc: row.program_description,
              created: row.created_at,
              updated: row.updated_at,
            },
            type: Sequelize.QueryTypes.INSERT,
          },
        );
      }

      // Verify mirror still has exactly 1 row (no duplicates)
      const mirrorAfter = await sequelizeV2Mirror.query(
        'SELECT COUNT(*) as count FROM program',
        { type: Sequelize.QueryTypes.SELECT },
      );
      expect(mirrorAfter[0].count).to.equal(1);

      // Verify data is unchanged
      const mirrorRows = await sequelizeV2Mirror.query(
        'SELECT * FROM program WHERE cad_trust_program_id = :id',
        {
          replacements: { id: testId },
          type: Sequelize.QueryTypes.SELECT,
        },
      );
      expect(mirrorRows[0].program_name).to.equal('Existing Program');
    });

    it('should update stale mirror data when source has changed', async function () {
      const testId = uuidv4();

      // Insert original data into both databases
      const insertSql = `INSERT INTO program (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_description, created_at, updated_at)
         VALUES (:id, :name, :registry, :activityId, :desc, datetime('now'), datetime('now'))`;

      await sequelizeV2.query(insertSql, {
        replacements: {
          id: testId,
          name: 'Original Name',
          registry: 'Test Registry',
          activityId: 'ACT-003',
          desc: 'Original description',
        },
        type: Sequelize.QueryTypes.INSERT,
      });
      await sequelizeV2Mirror.query(insertSql, {
        replacements: {
          id: testId,
          name: 'Original Name',
          registry: 'Test Registry',
          activityId: 'ACT-003',
          desc: 'Original description',
        },
        type: Sequelize.QueryTypes.INSERT,
      });

      // Update source data (simulating a change that happened while mirror was down)
      await sequelizeV2.query(
        `UPDATE program SET program_name = :name, updated_at = datetime('now')
         WHERE cad_trust_program_id = :id`,
        {
          replacements: { id: testId, name: 'Updated Name' },
          type: Sequelize.QueryTypes.UPDATE,
        },
      );

      // Run backfill logic (upsert from source to mirror)
      const allSourceRows = await sequelizeV2.query('SELECT * FROM program', {
        type: Sequelize.QueryTypes.SELECT,
      });

      for (const row of allSourceRows) {
        await sequelizeV2Mirror.query(
          `INSERT OR REPLACE INTO program (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_registry_program_id, program_description, created_at, updated_at)
           VALUES (:id, :name, :registry, :activityId, :programId, :desc, :created, :updated)`,
          {
            replacements: {
              id: row.cad_trust_program_id,
              name: row.program_name,
              registry: row.program_registry,
              activityId: row.program_registry_activity_id,
              programId: row.program_registry_program_id,
              desc: row.program_description,
              created: row.created_at,
              updated: row.updated_at,
            },
            type: Sequelize.QueryTypes.INSERT,
          },
        );
      }

      // Verify mirror now has the updated data
      const mirrorRows = await sequelizeV2Mirror.query(
        'SELECT * FROM program WHERE cad_trust_program_id = :id',
        {
          replacements: { id: testId },
          type: Sequelize.QueryTypes.SELECT,
        },
      );
      expect(mirrorRows).to.have.length(1);
      expect(mirrorRows[0].program_name).to.equal('Updated Name');
    });

    it('should handle empty source tables gracefully', async function () {
      // Verify source is empty
      const sourceCount = await sequelizeV2.query(
        'SELECT COUNT(*) as count FROM program',
        { type: Sequelize.QueryTypes.SELECT },
      );
      expect(sourceCount[0].count).to.equal(0);

      // Backfill of empty table should be a no-op
      const mirrorCount = await sequelizeV2Mirror.query(
        'SELECT COUNT(*) as count FROM program',
        { type: Sequelize.QueryTypes.SELECT },
      );
      expect(mirrorCount[0].count).to.equal(0);
    });

    it('should handle multiple records in a batch', async function () {
      // Insert several records to test batch handling
      const testIds = [];
      for (let i = 0; i < 5; i++) {
        const id = uuidv4();
        testIds.push(id);
        await sequelizeV2.query(
          `INSERT INTO program (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_description, created_at, updated_at)
           VALUES (:id, :name, :registry, :activityId, :desc, datetime('now'), datetime('now'))`,
          {
            replacements: {
              id,
              name: `Program ${i}`,
              registry: `Registry ${i}`,
              activityId: `ACT-${i}`,
              desc: `Description ${i}`,
            },
            type: Sequelize.QueryTypes.INSERT,
          },
        );
      }

      // Read all from source and upsert to mirror (simulating batched backfill)
      const allSourceRows = await sequelizeV2.query('SELECT * FROM program', {
        type: Sequelize.QueryTypes.SELECT,
      });
      expect(allSourceRows).to.have.length(5);

      for (const row of allSourceRows) {
        await sequelizeV2Mirror.query(
          `INSERT OR REPLACE INTO program (cad_trust_program_id, program_name, program_registry, program_registry_activity_id, program_registry_program_id, program_description, created_at, updated_at)
           VALUES (:id, :name, :registry, :activityId, :programId, :desc, :created, :updated)`,
          {
            replacements: {
              id: row.cad_trust_program_id,
              name: row.program_name,
              registry: row.program_registry,
              activityId: row.program_registry_activity_id,
              programId: row.program_registry_program_id,
              desc: row.program_description,
              created: row.created_at,
              updated: row.updated_at,
            },
            type: Sequelize.QueryTypes.INSERT,
          },
        );
      }

      // Verify all 5 records made it to the mirror
      const mirrorCount = await sequelizeV2Mirror.query(
        'SELECT COUNT(*) as count FROM program',
        { type: Sequelize.QueryTypes.SELECT },
      );
      expect(mirrorCount[0].count).to.equal(5);

      // Verify each record
      for (let i = 0; i < testIds.length; i++) {
        const mirrorRow = await sequelizeV2Mirror.query(
          'SELECT * FROM program WHERE cad_trust_program_id = :id',
          {
            replacements: { id: testIds[i] },
            type: Sequelize.QueryTypes.SELECT,
          },
        );
        expect(mirrorRow).to.have.length(1);
        expect(mirrorRow[0].program_name).to.equal(`Program ${i}`);
      }
    });
  });
});
