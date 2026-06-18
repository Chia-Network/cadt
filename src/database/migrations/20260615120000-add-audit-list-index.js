'use strict';

// Composite index on the V1 audit table to make the audit list endpoint's
// per-org, time-ordered pagination usable by the SQLite planner.
//
// Hot-path query in src/controllers/audit.controller.js findAll:
//
//   Audit.findAll({
//     where: { orgUid },
//     order: [['onchainConfirmationTimeStamp', order]],
//     limit, offset,
//   })
//
// Without an index covering both the WHERE and the ORDER BY, the planner
// materializes the org's entire row set (including the large `change` TEXT)
// and does a temp-B-tree sort on every request. The composite index lets it
// do an ordered range scan, removing the sort; deep OFFSET still walks index
// entries but no longer reads the `change` blob for skipped rows. Idempotent
// so re-running is safe.

const INDEXES = [
  {
    fields: ['orgUid', 'onchainConfirmationTimeStamp'],
    name: 'audit_org_uid_onchain_timestamp',
  },
];

const isDuplicateIndexError = (error) => {
  const message = error?.message || '';
  return /already exists/i.test(message) || /duplicate key name/i.test(message);
};

export default {
  async up(queryInterface) {
    for (const { fields, name } of INDEXES) {
      try {
        await queryInterface.addIndex('audit', fields, { name });
      } catch (error) {
        // Idempotent: ignore "already exists" so re-running the migration
        // (e.g. after a partial run) doesn't fail.
        if (!isDuplicateIndexError(error)) {
          throw error;
        }
      }
    }
  },

  async down(queryInterface) {
    for (const { name } of INDEXES) {
      try {
        await queryInterface.removeIndex('audit', name);
      } catch {
        // Best-effort drop on rollback.
      }
    }
  },
};
