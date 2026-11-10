import { StagingV2 } from '../models/v2/index.js';
import { CASCADE_DELETE_CHILDREN } from './v2-cascade-delete.js';
import { deletePreviewError } from './v2-delete-preview-tokens.js';

const malformedRecord = (record, model, action) => {
  if (!record || typeof record !== 'object' || Array.isArray(record))
    return true;
  const primaryKey = model.primaryKeyAttribute;
  const primaryValue =
    record[primaryKey] ?? record[model.rawAttributes[primaryKey].field];
  if (typeof primaryValue !== 'string' || !primaryValue.trim()) return true;
  return Object.entries(model.rawAttributes).some(([field, attribute]) => {
    if (field === primaryKey || !field.startsWith('cadTrust')) return false;
    const value = record[field] ?? record[attribute.field];
    if (value == null)
      return action === 'INSERT' && attribute.allowNull === false;
    return typeof value !== 'string' || !value.trim();
  });
};

// Use canonical model attributes for snake/camel payload parity. Looking at both
// the existing target ID and every FK catches updates that reparent rows away
// from the committed graph as well as inserts/reparenting into it.
export const assertNoDeletePreviewStagingConflicts = async (plan, options) => {
  const modelMap = StagingV2.getMutationGuardModelMap();
  const idsByField = new Map();
  for (const member of plan.members) {
    const model = modelMap[member.table];
    const field = model.primaryKeyAttribute;
    if (!idsByField.has(field)) idsByField.set(field, new Set());
    idsByField.get(field).add(member.id);
  }
  // Project self-reference uses a distinct FK name for the same target type.
  if (idsByField.has('cadTrustProjectId')) {
    idsByField.set(
      'cadTrustReferenceProjectId',
      idsByField.get('cadTrustProjectId'),
    );
  }
  // Include empty descendant tables: an unreadable row there might add children.
  const descendantTables = new Set([plan.root.table]);
  for (const { parent, model } of CASCADE_DELETE_CHILDREN) {
    if (descendantTables.has(parent)) descendantTables.add(model.tableName);
  }
  const relevantModels = Object.values(modelMap).filter(
    (model) =>
      descendantTables.has(model.tableName) ||
      Object.keys(model.rawAttributes).some((field) => idsByField.has(field)),
  );
  const rows = await StagingV2.findAll({
    where: { table: relevantModels.map((model) => model.tableName) },
    raw: true,
    transaction: options.transaction,
  });
  for (const row of rows) {
    const model = modelMap[row.table];
    let records;
    try {
      const parsed = JSON.parse(row.data);
      records = Array.isArray(parsed) ? parsed : [parsed];
      if (
        !records.length ||
        records.some((record) => malformedRecord(record, model, row.action))
      )
        throw new Error('Invalid staging payload');
    } catch {
      throw deletePreviewError(
        'DELETE_PREVIEW_STAGING_CONFLICT',
        `Cannot safely preview deletion while ${row.table} staging row ${row.uuid} contains malformed data. Resolve that staged row and request a new preview.`,
      );
    }
    for (const record of records) {
      for (const [field, ids] of idsByField) {
        const attribute = model.rawAttributes[field];
        if (
          attribute &&
          (ids.has(record[field]) || ids.has(record[attribute.field]))
        ) {
          throw deletePreviewError(
            'DELETE_PREVIEW_STAGING_CONFLICT',
            `Pending ${row.table} staging row ${row.uuid} overlaps this deletion. Commit or remove the conflicting work and request a new preview.`,
          );
        }
      }
    }
  }
};
