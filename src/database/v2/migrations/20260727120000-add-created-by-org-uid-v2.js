'use strict';

// One-time migration to add `created_by_org_uid` to the 14 v2 data tables that
// do not carry an `org_uid` column. The column records which organization
// originally created the record (set server-side from the home org).
//
// Backfill assumption (valid only at migration time): the org_uid reachable
// through existing foreign-key joins is treated as the likely creator. This is
// a best-effort guess — e.g. org A can legitimately create a child record
// against org B's project, in which case the backfill will attribute it to B.
// Going forward the column is populated at create time and is not inferred.
//
// NOTE on down(): SQLite's removeColumn rebuilds the table, which drops
// unrelated indexes. Do not run down() on SQLite without re-applying index
// migrations afterward.

const DIRECT_PROJECT_TABLES = [
  'validation',
  'verification',
  'location',
  'co_benefit',
  'estimation',
  'rating',
  'project_methodology',
  'stakeholder_projects',
];

const AEF_TABLES = [
  'aef_t2_authorizations',
  'aef_t3_actions',
  'aef_t4_holdings',
  'aef_t5_authorized_entities',
];

const ALL_TABLES = [
  ...DIRECT_PROJECT_TABLES,
  'issuance',
  'unit_label',
  ...AEF_TABLES,
];

async function safeAddColumn(queryInterface, table, column, definition) {
  try {
    await queryInterface.addColumn(table, column, definition);
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log(`[migration] Column ${column} already exists on ${table}, skipping`);
      return;
    }
    throw err;
  }
}

async function safeAddIndex(queryInterface, table, columns, options) {
  try {
    await queryInterface.addIndex(table, columns, options);
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`[migration] Index ${options.name} already exists on ${table}, skipping`);
      return;
    }
    throw err;
  }
}

export default {
  async up(queryInterface, Sequelize) {
    console.log('[migration] Adding created_by_org_uid to 14 tables');

    // Phase 1: Add column + index to every table (idempotent per table so a
    // partial failure followed by a retry completes the remaining tables).
    for (const table of ALL_TABLES) {
      console.log(`[migration] Phase 1: ${table} — adding column + index`);
      await safeAddColumn(queryInterface, table, 'created_by_org_uid', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
      await safeAddIndex(queryInterface, table, ['created_by_org_uid'], {
        name: `${table}_created_by_org_uid`,
      });
    }

    // Phase 2: Backfill from parent joins (correlated subqueries are portable
    // across SQLite and MySQL — both dialects this migration runs on).
    // The WHERE IS NULL guard makes every statement safe to re-run.
    console.log('[migration] Phase 2: backfilling created_by_org_uid from parent joins');

    // Direct project join (8 tables)
    for (const table of DIRECT_PROJECT_TABLES) {
      console.log(`[migration] Backfilling ${table} via project join`);
      await queryInterface.sequelize.query(`
        UPDATE ${table} SET created_by_org_uid =
          (SELECT p.org_uid FROM project p
           WHERE p.cad_trust_project_id = ${table}.cad_trust_project_id)
        WHERE created_by_org_uid IS NULL
      `);
    }

    // Two-hop: issuance → verification → project
    console.log('[migration] Backfilling issuance via verification → project join');
    await queryInterface.sequelize.query(`
      UPDATE issuance SET created_by_org_uid =
        (SELECT p.org_uid FROM verification v
         JOIN project p ON p.cad_trust_project_id = v.cad_trust_project_id
         WHERE v.cad_trust_verification_id = issuance.cad_trust_verification_id)
      WHERE created_by_org_uid IS NULL
    `);

    // Unit join: unit_label → unit
    console.log('[migration] Backfilling unit_label via unit join');
    await queryInterface.sequelize.query(`
      UPDATE unit_label SET created_by_org_uid =
        (SELECT u.org_uid FROM unit u
         WHERE u.cad_trust_unit_id = unit_label.cad_trust_unit_id)
      WHERE created_by_org_uid IS NULL
    `);

    // AEF tables: COALESCE across nullable FKs (project, unit, aef_t1_submission)
    for (const table of AEF_TABLES) {
      console.log(`[migration] Backfilling ${table} via COALESCE(project, unit, submission)`);
      await queryInterface.sequelize.query(`
        UPDATE ${table} SET created_by_org_uid = COALESCE(
          (SELECT p.org_uid FROM project p
           WHERE p.cad_trust_project_id = ${table}.cad_trust_project_id),
          (SELECT u.org_uid FROM unit u
           WHERE u.cad_trust_unit_id = ${table}.cad_trust_unit_id),
          (SELECT s.org_uid FROM aef_t1_submission s
           WHERE s.cad_trust_aef_t1_submission_id = ${table}.cad_trust_aef_t1_submission_id))
        WHERE created_by_org_uid IS NULL
      `);
    }

    console.log('[migration] created_by_org_uid migration complete');
  },

  async down(queryInterface) {
    console.log('[migration-down] Removing created_by_org_uid from 14 tables');
    for (const table of ALL_TABLES) {
      try {
        await queryInterface.removeIndex(table, `${table}_created_by_org_uid`);
      } catch (err) {
        console.warn(`[migration-down] Could not remove index on ${table}:`, err.message);
      }
      await queryInterface.removeColumn(table, 'created_by_org_uid');
    }
  },
};
