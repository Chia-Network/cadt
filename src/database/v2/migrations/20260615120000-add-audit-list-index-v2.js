'use strict';

// Composite index on the V2 audit table to make the audit list endpoint's
// per-org, time-ordered pagination usable by the SQLite/MySQL planner.
//
// Hot-path query in src/models/v2/audit-v2.model.js findAuditHistory:
//
//   AuditV2.findAll({
//     where: { org_uid },
//     order: [['onchain_confirmation_time_stamp', order]],
//     limit, offset,
//   })
//
// Without an index covering both the WHERE and the ORDER BY, the planner
// materializes the org's entire row set (including the large `change` TEXT)
// and does a temp-B-tree sort on every request. The composite index removes
// the sort; deep OFFSET still walks index entries but no longer reads the
// `change` blob for skipped rows. Symmetric with the V1 audit-list index
// migration. Idempotent so re-running is safe.

const INDEXES = [
  {
    fields: ['org_uid', 'onchain_confirmation_time_stamp'],
    name: 'audit_v2_org_uid_onchain_timestamp',
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
        // doesn't fail on either dialect.
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
