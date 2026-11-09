import { Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { sequelizeV2 } from '../database/v2/index.js';
import { StagingV2 } from '../models/v2/index.js';
import { processingSyncRegistriesTransactionMutexV2 } from './v2-mutex-utils.js';
import { assertNoDeletePreviewStagingConflicts } from './v2-delete-preview-conflicts.js';
import { inspectDeletePlan } from './v2-delete-preview.js';
import {
  deletePreviewTokens,
  deletePreviewError,
} from './v2-delete-preview-tokens.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
} from './v2-data-assertions.js';

// Sequelize 6 SQLite forceCleanup destroys an abstract pool resource, but its
// SQLite connections are tracked separately. A rejected COMMIT can therefore
// leave a live transaction/connection after Sequelize sets finished='commit'.
// Confine rollback/close recovery to this operation; never install a receipt via
// afterCommit (this version invokes those hooks even when COMMIT rejects).
const recoverFailedSqliteCommit = async (transaction) => {
  const manager = sequelizeV2.connectionManager;
  if (
    sequelizeV2.getDialect() !== 'sqlite' ||
    transaction?.finished !== 'commit' ||
    manager.connections[transaction.id] !== transaction.connection
  )
    return;
  try {
    await sequelizeV2.getQueryInterface().rollbackTransaction(transaction, {});
  } finally {
    await new Promise((resolve, reject) =>
      transaction.connection.close((error) =>
        error ? reject(error) : resolve(),
      ),
    );
    delete manager.connections[transaction.id];
  }
};

/** The operation lock spans validation, SQLite's write-intent transaction and
 * receipt installation. Human review holds neither lock nor DB transaction. */
export const confirmDelete = async (
  table,
  id,
  token,
  { tokenStore = deletePreviewTokens } = {},
) => {
  await assertV2IfReadOnlyMode();
  const release = await processingSyncRegistriesTransactionMutexV2.acquire();
  let claim;
  let activeTransaction;
  try {
    const result = await sequelizeV2.transaction(
      { type: Transaction.TYPES.IMMEDIATE },
      async (transaction) => {
        activeTransaction = transaction;
        const options = { transaction };
        await assertV2IfReadOnlyMode();
        const homeOrg = await assertV2HomeOrgExists(options);
        const binding = {
          table,
          id,
          orgUid: homeOrg.org_uid,
          registryId: homeOrg.registry_id,
        };
        // A receipt survives caller edits, removal, selective commit and root sync.
        // Check it before pending work, root existence or current graph discovery.
        if (token !== undefined) {
          const receipt = tokenStore.receipt(token, binding);
          if (receipt) return receipt;
        }
        await assertNoPendingCommitsExcludingTransfers(options);
        const { plan, context } = await inspectDeletePlan(
          table,
          id,
          homeOrg,
          options,
        );
        if (token === undefined && plan.descendantCount > 0) {
          throw Object.assign(
            deletePreviewError(
              'DELETE_CONFIRMATION_REQUIRED',
              'Deletion includes children. Request a delete preview and send its token in X-Deletion-Confirmation.',
            ),
            { previewRoute: `/v2/${table}/${id}/delete-preview` },
          );
        }
        const result = {
          message: `${table[0].toUpperCase()}${table.slice(1)} delete staged successfully`,
          stagedChildDeletes: plan.descendantCount,
          success: true,
        };
        if (token !== undefined) {
          const reviewed = tokenStore.lookup(token, binding);
          if (reviewed.fingerprint !== context.fingerprint)
            throw deletePreviewError(
              'DELETE_PREVIEW_CHANGED',
              'The affected records changed. Request and review a new delete preview.',
            );
        }
        if (token !== undefined || plan.descendantCount > 0)
          await assertNoDeletePreviewStagingConflicts(plan, options);
        if (token !== undefined)
          claim = tokenStore.claim(token, binding, result);
        const rows = plan.members.map((member) => ({
          uuid: uuidv4(),
          table: member.table,
          data: JSON.stringify([{ [member.primaryKeyField]: member.id }]),
          action: 'DELETE',
          committed: false,
          failed_commit: false,
          is_transfer: false,
        }));
        // Stage the compared members directly; never rediscover after validation.
        if (rows.length > 1) await StagingV2.bulkCreate(rows.slice(1), options);
        await StagingV2.create(rows[0], options);
        return result;
      },
    );
    claim?.complete();
    return result;
  } catch (error) {
    try {
      await recoverFailedSqliteCommit(activeTransaction);
    } catch (cleanupError) {
      error.cause = cleanupError;
    }
    claim?.release();
    if (token !== undefined && error.code === 'DELETE_PREVIEW_NOT_FOUND')
      throw deletePreviewError(
        'DELETE_PREVIEW_CHANGED',
        'The reviewed root no longer exists. Request a new delete preview.',
      );
    throw error;
  } finally {
    release();
  }
};
