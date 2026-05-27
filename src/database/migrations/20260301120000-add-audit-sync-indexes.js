'use strict';

// Composite indexes on the V1 audit table to make the per-tick "find last
// processed generation for this org" query usable by the SQLite planner.
//
// Hot-path query in src/tasks/sync-registries.js:
//
//   Audit.findOne({
//     where: { registryId: organization.registryId },
//     order: [['generation', 'DESC']],
//   })
//
// The legacy schema has only the implicit `id` PK, so this query degrades to
// a full table scan + sort once the audit table is large. The same pattern
// applies to orgUid lookups elsewhere in the codebase. Indexes are
// idempotent (IF NOT EXISTS via Sequelize's migration meta) so this is safe
// to re-run.

const INDEXES = [
  {
    fields: ['registryId', 'generation'],
    name: 'audit_registry_id_generation',
  },
  { fields: ['orgUid', 'generation'], name: 'audit_org_uid_generation' },
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
