import { createHash } from 'node:crypto';
import { Transaction } from 'sequelize';
import { sequelizeV2 } from '../database/v2/index.js';
import { StagingV2 } from '../models/v2/index.js';
import { discoverCascadeDeletePlan } from './v2-cascade-delete.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
} from './v2-data-assertions.js';
import {
  checkReferences,
  checkUnitReferencesForIds,
  buildReferenceConflictBody,
} from './v2-reference-guards.js';
import { assertNoDeletePreviewStagingConflicts } from './v2-delete-preview-conflicts.js';
import {
  deletePreviewTokens,
  deletePreviewError,
} from './v2-delete-preview-tokens.js';

// Canonicalize object key order, including semantic JSON columns. Local Sequelize
// timestamps are deliberately excluded: sync can recreate them without a change
// to the reviewed graph. All other committed values participate in the digest.
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
};
const semanticRecord = (record) =>
  Object.fromEntries(
    Object.entries(record).filter(
      ([key]) =>
        !['createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(key),
    ),
  );

const assertReferences = async (table, id, plan, options) => {
  if (!['project', 'unit'].includes(table)) return;
  const result = await checkReferences(table, id, options);
  if (result.hasReferences) {
    throw Object.assign(
      deletePreviewError(
        'DELETE_PREVIEW_REFERENCED',
        buildReferenceConflictBody(table, result).message,
      ),
      { references: result.references },
    );
  }
  if (table === 'project') {
    const units = plan.members
      .filter((member) => member.table === 'unit')
      .map((member) => member.id);
    const childResult = await checkUnitReferencesForIds(units, options);
    if (childResult.hasReferences) {
      throw Object.assign(
        deletePreviewError(
          'DELETE_PREVIEW_REFERENCED',
          buildReferenceConflictBody(table, childResult).message,
        ),
        { references: childResult.references },
      );
    }
  }
};

/** Shared discovery, ownership, reference and semantic snapshot for preview and
 * confirmation. The caller owns the snapshot and its write-intent lock. */
export const inspectDeletePlan = async (
  table,
  id,
  homeOrg,
  options,
  { maxRecords = 10000 } = {},
) => {
  const modelMap = StagingV2.getMutationGuardModelMap();
  const rootModel = modelMap[table];
  if (!['project', 'verification', 'issuance', 'unit'].includes(table))
    throw new Error('Unsupported delete preview root');
  const root = await rootModel.findByPk(id, options);
  if (!root)
    throw deletePreviewError(
      'DELETE_PREVIEW_NOT_FOUND',
      `${table} not found`,
      404,
    );
  const plan = await discoverCascadeDeletePlan(table, id, options);
  if (plan.totalCount > maxRecords)
    throw deletePreviewError(
      'DELETE_PREVIEW_TOO_LARGE',
      'Deletion preview exceeds the complete response limit. Preview a smaller root.',
      413,
    );
  const records = [];
  for (const member of plan.members) {
    await StagingV2.assertMutationOwnedByHomeOrg(
      {
        table: member.table,
        action: 'DELETE',
        data: [{ [member.primaryKeyField]: member.id }],
      },
      options,
      homeOrg.org_uid,
    );
    const record = await modelMap[member.table].findByPk(member.id, {
      ...options,
      raw: true,
    });
    records.push({
      table: member.table,
      id: member.id,
      values: semanticRecord(record),
    });
  }
  await assertReferences(table, id, plan, options);
  const context = {
    table,
    id,
    orgUid: homeOrg.org_uid,
    registryId: homeOrg.registry_id,
    fingerprint: createHash('sha256')
      .update(
        JSON.stringify(
          canonical({
            table,
            id,
            orgUid: homeOrg.org_uid,
            registryId: homeOrg.registry_id,
            records,
          }),
        ),
      )
      .digest('hex'),
  };
  return { plan, context };
};

/** Build a complete read-only preview in one DEFERRED snapshot, then admit its
 * compact token only after successful snapshot completion and size validation.
 */
export const createDeletePreview = async (
  table,
  id,
  {
    tokenStore = deletePreviewTokens,
    maxRecords = 10000,
    maxResponseBytes = 1048576,
  } = {},
) => {
  await assertV2IfReadOnlyMode();
  const { body, context } = await sequelizeV2.transaction(
    { type: Transaction.TYPES.DEFERRED },
    async (transaction) => {
      const options = { transaction };
      const homeOrg = await assertV2HomeOrgExists(options);
      await assertNoPendingCommitsExcludingTransfers(options);
      const { plan, context } = await inspectDeletePlan(
        table,
        id,
        homeOrg,
        options,
        { maxRecords },
      );
      await assertNoDeletePreviewStagingConflicts(plan, options);
      const childCounts = { ...plan.counts };
      delete childCounts[table];
      const body = {
        success: true,
        target: { table, id },
        confirmationRequired: plan.descendantCount > 0,
        childCounts,
        totalRecords: plan.totalCount,
        affectedRecords: plan.members.map(
          ({ table: memberTable, id: memberId }) => ({
            table: memberTable,
            id: memberId,
          }),
        ),
        confirmationToken: 'x'.repeat(43),
        expiresAt: '2000-01-01T00:00:00.000Z',
      };
      if (Buffer.byteLength(JSON.stringify(body)) > maxResponseBytes)
        throw deletePreviewError(
          'DELETE_PREVIEW_TOO_LARGE',
          'Deletion preview exceeds the complete response byte limit. Preview a smaller root.',
          413,
        );
      return { body, context };
    },
  );
  const { token, expiresAt } = tokenStore.mint(context);
  return { ...body, confirmationToken: token, expiresAt };
};
