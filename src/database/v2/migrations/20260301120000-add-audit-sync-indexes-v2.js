'use strict';

// Composite indexes on the V2 audit table to make the per-tick "find last
// processed generation for this org" query usable by the SQLite/MySQL planner.
//
// Hot-path query in src/tasks/sync-registries-v2.js:
//
//   AuditV2.findOne({
//     where: { registry_id: organization.registry_id },
//     order: [['generation', 'DESC']],
//   })
//
// V2's create-audit migration only declares the implicit `id` PK, so this
// query degrades to a full table scan + sort once the audit table is large.
// Symmetric with the V1 audit-sync index migration.

const INDEXES = [
  {
    fields: ['registry_id', 'generation'],
    name: 'audit_v2_registry_id_generation',
  },
  { fields: ['org_uid', 'generation'], name: 'audit_v2_org_uid_generation' },
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
