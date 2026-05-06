import _ from 'lodash';

import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization, Audit, ModelKeys, Staging, Meta } from '../models';
import datalayer from '../datalayer';
import {
  decodeHex,
  encodeHex,
  optimizeAndSortKvDiff,
  isOwnedStoreLocalDataMissing,
} from '../utils/datalayer-utils';
import dotenv from 'dotenv';
import { logger } from '../config/logger.js';
import { sequelize, sequelizeMirror } from '../database';
import { getConfig } from '../utils/config-loader';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { mirrorDBEnabled } from '../database';
import {
  migrateToNewSync,
  generateGenerationIndex,
} from '../utils/sync-migration-utils';
import {
  processingSyncRegistriesTransactionMutex,
  syncRegistriesTaskMutex,
} from '../utils/model-utils.js';
import { SyncMismatchBackoff } from '../utils/sync-mismatch-backoff.js';
import {
  ensureV1FtsTriggersDeferred,
  restoreV1FtsTriggersAndRebuildIfDeferred,
} from '../utils/fts5-deferral.js';

dotenv.config({ quiet: true });
const CONFIG = getConfig().APP;

const mismatchBackoff = new SyncMismatchBackoff(logger, '[v1]');

const hasUsableSyncStatus = (syncStatus) =>
  syncStatus?.generation != null && syncStatus?.target_generation != null;

const task = new Task('sync-registries', async () => {
  logger.debug('[v1]: sync registries task invoked');
  if (!syncRegistriesTaskMutex.isLocked()) {
    const releaseSyncTaskMutex = await syncRegistriesTaskMutex.acquire();
    try {
      const hasMigratedToNewSyncMethod = await Meta.findOne({
        where: { metaKey: 'migratedToNewSync' },
      });

      const hasMigratedToGenerationIndexSync = await Meta.findOne({
        where: { metaKey: 'migratedToIndexBasedSync' },
      });

      if (hasMigratedToNewSyncMethod || CONFIG.USE_SIMULATOR) {
        if (hasMigratedToGenerationIndexSync) {
          await processJob();
        } else {
          await generateGenerationIndex();
        }
      } else {
        await migrateToNewSync();
      }
    } catch (error) {
      logger.error(`[v1]: Error during datasync: ${error.message}`);

      console.trace(error);

      // Log additional information if present in the error object
      if (error.response && error.response.body) {
        logger.error(
          `Additional error details: ${JSON.stringify(error.response.body)}`,
        );
      }
    } finally {
      releaseSyncTaskMutex();
    }
  } else {
    logger.debug(
      'could not acquire sync registries mutex. trying again shortly',
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG.USE_SIMULATOR ? 2 : 5,
    runImmediately: true,
  },
  task,
  { id: 'sync-registries', preventOverrun: true },
);

const processJob = async () => {
  await assertDataLayerAvailable();
  await assertWalletIsSynced();

  logger.debug(`[v1]: running sync-registries proccessJob()`);
  logger.debug(`[v1]: querying organization model`);
  const organizations = await Organization.findAll({
    where: { subscribed: true },
    raw: true,
  });

  // FTS5 deferral: when at least one subscribed org has not yet caught up,
  // drop the project/unit FTS triggers so the upserts in syncOrganizationAudit
  // don't pay the per-row tokenisation cost. The restore + rebuild runs
  // after this loop when no orgs need catch-up. The Organization.synced
  // flag is set by the sync loop itself, so on the very first tick after
  // a fresh boot all subscribed orgs may show synced=false until the loop
  // determines they're actually caught up. That's fine - the worst case
  // is that triggers are dropped one tick early and restored one tick
  // later than strictly necessary, neither of which is a correctness
  // problem because the rebuild reconciles regardless.
  //
  // Skip the global drop in NODE_ENV=test: the integration test suite
  // creates many `subscribed: true, synced: false` org fixtures while
  // the V1 background sync interval is live, and FTS-dependent specs
  // assume the project/unit triggers stay installed. The deferral
  // behaviour itself is exercised by tests/integration/sync-write-perf.spec.js
  // (which calls the helpers directly and isolates them from sync).
  const skipFtsDeferralForTests = process.env.NODE_ENV === 'test';

  const anyOrgNeedsCatchup = organizations.some(
    (organization) => !organization.synced,
  );
  if (anyOrgNeedsCatchup && !skipFtsDeferralForTests) {
    await ensureV1FtsTriggersDeferred();
  }

  try {
    for (const organization of organizations) {
      if (CONFIG.USE_SIMULATOR || process.env.NODE_ENV === 'test') {
        await syncOrganizationAudit(organization);
      } else {
        // Order by generation (not createdAt) so this lookup is served
        // by the audit_org_uid_generation composite index. Generation
        // is monotonic per orgUid in the sync forward path, so the two
        // orderings agree on the rootHash returned; ordering by
        // generation is also semantically what we want here ("the most
        // recently ingested generation for this org").
        const mostRecentOrgAuditRecord = await Audit.findOne({
          where: {
            orgUid: organization.orgUid,
          },
          order: [['generation', 'DESC']],
          limit: 1,
          raw: true,
        });

        // verify that the latest organization root hash is up to date with the audit records. attempt correction.
        if (
          mostRecentOrgAuditRecord &&
          mostRecentOrgAuditRecord?.rootHash !== organization?.registryHash
        ) {
          logger.warn(
            `latest root hash in org table for organization ${organization.name} (orgUid ${organization.orgUid}) does not match the audit records. attempting to correct`,
          );
          try {
            const result = await Organization.update(
              { registryHash: mostRecentOrgAuditRecord.rootHash },
              {
                where: { orgUid: organization.orgUid },
              },
            );

            if (result?.length) {
              logger.info(
                `registry hash record corrected for ${organization.name} (orgUid ${organization.orgUid}). proceeding with audit sync`,
              );
              const correctedOrganizationRecord = await Organization.findOne({
                where: { orgUid: organization.orgUid },
              });

              await syncOrganizationAudit(correctedOrganizationRecord);
            } else {
              throw new Error('organizations update query affected 0 records');
            }
          } catch (error) {
            logger.error(
              `failed to update organization table record for ${organization.name} (orgUid ${organization.orgUid}) with correct root hash. Something is wrong. Skipping audit sync and trying again shortly. Error: ${error}`,
            );
          }
        } else {
          // normal state, proceed with audit sync
          await syncOrganizationAudit(organization);
        }
      }
    }
  } finally {
    // After processing all orgs (or after an exception bubbles out of the
    // loop above), re-read the org table to see whether anyone is still
    // in catch-up. If everyone is caught up and triggers are currently
    // deferred, restore them + rebuild FTS in a single transaction. Run
    // in `finally` so a thrown sync error doesn't leave FTS triggers
    // permanently dropped until the next process restart.
    if (!skipFtsDeferralForTests) {
      try {
        const orgsAfter = await Organization.findAll({
          where: { subscribed: true },
          attributes: ['orgUid', 'synced'],
          raw: true,
        });
        const anyOrgStillCatchingUp = orgsAfter.some((o) => !o.synced);
        if (!anyOrgStillCatchingUp) {
          await restoreV1FtsTriggersAndRebuildIfDeferred();
        }
      } catch (restoreError) {
        // Don't shadow the original loop error if there was one. The next
        // tick will retry restore via the same finally block.
        logger.error(
          `[v1]: FTS5 restore decision failed at tick end: ${restoreError?.message || restoreError}`,
        );
      }
    }
  }
};

async function createAndProcessTransaction(callback, afterCommitCallbacks) {
  let transaction;
  let mirrorTransaction;

  logger.info(
    '[v1]: Starting sequelize transaction and acquiring transaction mutex',
  );
  const releaseTransactionMutex =
    await processingSyncRegistriesTransactionMutex.acquire();

  try {
    // Start a transaction
    transaction = await sequelize.transaction();

    if (mirrorDBEnabled()) {
      mirrorTransaction = await sequelizeMirror.transaction();
    }

    // Execute the provided callback with the transaction
    await callback(transaction, mirrorTransaction);

    // Commit the transaction if the callback completes without errors
    await transaction.commit();

    if (mirrorDBEnabled()) {
      await mirrorTransaction.commit();
    }

    for (const afterCommitCallback of afterCommitCallbacks) {
      await afterCommitCallback();
    }

    logger.info('[v1]: Commited sequelize transaction');

    return true;
  } catch (error) {
    // Roll back the transaction if an error occurs
    if (transaction) {
      logger.error(
        `encountered error syncing organization audit. Rolling back transaction. Error: ${error}`,
      );
      await transaction.rollback();
    }
    if (mirrorTransaction) {
      try {
        await mirrorTransaction.rollback();
      } catch (rollbackErr) {
        logger.error(`mirror transaction rollback failed: ${rollbackErr.message}`);
      }
    }
    return false;
  } finally {
    releaseTransactionMutex();
  }
}

const tryParseJSON = (jsonString, defaultValue) => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
};

const truncateStaging = async () => {
  logger.info(`[v1]: ATTEMPTING TO CLEAN UP STAGING TABLE`);

  let success = false;
  let attempts = 0;
  const maxAttempts = 5;

  while (!success && attempts < maxAttempts) {
    try {
      if (CONFIG.USE_SIMULATOR) {
        // Simulator-mode cleanup: delete only committed non-transfer
        // records. Project transfers are staged with commited: true +
        // isTransfer: true and must persist until the offer flow consumes
        // them (see Staging.generateOfferFile and
        // offer.controller.cancelActiveOffer, which destroys the
        // isTransfer row on cancel). Excluding them here matches the
        // existing v1 cancelActiveOffer contract.
        //
        // The non-simulator branch below still calls truncate()
        // unconditionally; that pre-existing race on the v1 transfer
        // flow is out of scope for this change.
        await Staging.destroy({
          where: { commited: true, isTransfer: false },
        });
      } else {
        await Staging.truncate();
      }
      success = true;
      logger.info('[v1]: STAGING TABLE CLEANED UP SUCCESSFULLY');
    } catch (error) {
      attempts++;
      logger.error(
        `STAGING CLEANUP FAILED ON ATTEMPT ${attempts}: ${error.message}`,
      );
      if (attempts < maxAttempts) {
        logger.info('[v1]: WAITING 1 SECOND BEFORE RETRYING...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        logger.error(
          '[v1]: MAXIMUM STAGING CLEANUP ATTEMPTS REACHED, GIVING UP',
        );
      }
    }
  }
};

const syncOrganizationAudit = async (organization) => {
  logger.debug(`[v1]: syncing organization audit for ${organization.name}`);
  try {
    const afterCommitCallbacks = [];

    logger.debug(`[v1]: querying organization model for home org`);
    const homeOrg = await Organization.getHomeOrg();
    logger.debug(
      `[v1]: querying datalayer for ${organization.name} root history`,
    );
    const rootHistory = await datalayer.getRootHistory(organization.registryId);
    logger.debug(
      `[v1]: querying datalayer for ${organization.name} sync status`,
    );
    const { sync_status } = await datalayer.getDataLayerStoreSyncStatus(
      organization.registryId,
    );

    if (!rootHistory?.length) {
      logger.warn(
        `Could not find root history for ${organization.name} (orgUid ${organization.orgUid}, registryId ${organization.registryId}), something is wrong and the sync for this organization will be paused until this is resolved.`,
      );
      return;
    }

    // For home org, skip the sync_status check - our own data is already local
    // The sync_status might lag behind because datalayer is still processing our own updates
    const isHomeOrg = homeOrg && organization.orgUid === homeOrg.orgUid;

    if (
      process.env.NODE_ENV !== 'test' &&
      !isHomeOrg &&
      mismatchBackoff.shouldSkip({
        orgId: organization.orgUid,
        orgName: organization.name,
        rootHistoryLength: rootHistory.length,
        generation: sync_status?.generation,
        targetGeneration: sync_status?.target_generation,
      })
    ) {
      return;
    }

    mismatchBackoff.clearIfResolved(organization.orgUid, organization.name);

    // For home org, log if there's a mismatch but proceed anyway
    if (isHomeOrg && rootHistory.length - 1 !== sync_status?.generation) {
      if (isOwnedStoreLocalDataMissing(sync_status)) {
        logger.error(
          `[v1]: CRITICAL: DataLayer store for ${organization.name} (${organization.registryId}) has lost its local data. ` +
            `sync_status.generation=0 with empty root hash, but blockchain shows target_generation=${sync_status.target_generation}. ` +
            `The DataLayer database was likely deleted or reset. ` +
            `DO NOT commit new data until this is resolved -- DataLayer will silently discard it.`,
        );
      } else {
        logger.debug(
          `[v1]: Home org sync_status lag (rootHistory.length-1=${rootHistory.length - 1} vs generation=${sync_status?.generation}), proceeding anyway as data is local`,
        );
      }
    }

    /**
     * IMPORTANT: audit data 'generation' field is a generation INDEX, not the actual generation number
     */
    let lastRootSavedToAuditTable;

    if (CONFIG.USE_SIMULATOR) {
      console.log('USING MOCK ROOT HISTORY');
      lastRootSavedToAuditTable = rootHistory[0];
      lastRootSavedToAuditTable.rootHash = lastRootSavedToAuditTable.root_hash;
      lastRootSavedToAuditTable.generation = 0;
    } else {
      logger.debug(
        `querying audit table for last root of ${organization.name}`,
      );
      lastRootSavedToAuditTable = await Audit.findOne({
        where: { registryId: organization.registryId },
        order: [['generation', 'DESC']],
        raw: true,
      });

      if (lastRootSavedToAuditTable) {
        // There was an oversight in the audit model where we named it onChainConfirmationTimeStamp but
        // the RPC result calls in timestamp. This is a temporary fix to ensure that we can still sync
        lastRootSavedToAuditTable.timestamp = Number(
          lastRootSavedToAuditTable?.onchainConfirmationTimeStamp || 0,
        );
        lastRootSavedToAuditTable.root_hash =
          lastRootSavedToAuditTable.rootHash;
      }
    }

    const highestStoreGeneration = _.get(rootHistory, '[0]');

    if (!lastRootSavedToAuditTable) {
      logger.info(
        `Syncing new registry ${organization.name} (orgUid ${organization.orgUid}, registryId ${organization.registryId})`,
      );

      logger.debug(`[v1]: creating 'CREATE REGISTRY' audit entry`);
      await Audit.create({
        orgUid: organization.orgUid,
        registryId: organization.registryId,
        rootHash: highestStoreGeneration.root_hash,
        type: 'CREATE REGISTRY',
        generation: 0,
        change: null,
        table: null,
        onchainConfirmationTimeStamp:
          highestStoreGeneration.timestamp.toString(),
      });

      // Destroy existing records for this singleton
      // On a fresh db this does nothing, but when the audit table
      // is reset this will ensure that this organizations registry data is
      // cleaned up on both the local db and mirror db and ready to resync
      await Promise.all(
        Object.keys(ModelKeys).map(async (modelKey) => {
          logger.debug(
            `performing destroy operation on home organization data in model ${modelKey}`,
          );
          ModelKeys[modelKey].destroy({
            where: {
              orgUid: organization.orgUid,
            },
          });
        }),
      );

      return;
    }

    const auditTableHighestProcessedGenerationIndex =
      lastRootSavedToAuditTable.generation; // generation -> generation INDEX
    logger.debug(
      `1 Last processed generation index of ${organization.name}: ${auditTableHighestProcessedGenerationIndex}`,
    );

    const rootHistoryHighestGenerationIndex = rootHistory.length - 1;
    const syncRemaining =
      Math.abs(rootHistoryHighestGenerationIndex) -
      Math.abs(auditTableHighestProcessedGenerationIndex);
    const isSynced = syncRemaining === 0;
    logger.debug(
      `2 the root history length for ${organization.name} is ${rootHistory.length} and the last processed generation index is ${auditTableHighestProcessedGenerationIndex}`,
    );
    logger.debug(
      `2 the highest root history index is ${rootHistoryHighestGenerationIndex}, given this and the last processed index, the number of generations left to sync is ${syncRemaining}`,
    );
    logger.debug(
      `updating organization model with new sync status for ${organization.name}`,
    );
    await Organization.update(
      {
        synced: isSynced,
        sync_remaining: syncRemaining,
      },
      { where: { orgUid: organization.orgUid } },
    );

    if (process.env.NODE_ENV !== 'test' && isSynced) {
      logger.debug(
        `${organization.name}: is synced. the last processed index is ${auditTableHighestProcessedGenerationIndex} and the highest root history index is ${rootHistoryHighestGenerationIndex}`,
      );
      return;
    }

    const toBeProcessedDatalayerGenerationIndex =
      auditTableHighestProcessedGenerationIndex + 1;
    logger.debug(
      `3 Last processed generation index of ${organization.name}: ${auditTableHighestProcessedGenerationIndex}`,
    );
    logger.debug(
      `4 To be processed generation index of ${organization.name}: ${toBeProcessedDatalayerGenerationIndex}`,
    );

    // Organization not synced, sync it
    logger.info('[v1]:  ');
    logger.info(
      `Syncing ${organization.name} generation index ${toBeProcessedDatalayerGenerationIndex} (orgUid ${organization.orgUid}, registryId ${organization.registryId})`,
    );
    logger.info(
      `${organization.name} is ${syncRemaining} DataLayer generations away from being fully synced (orgUid ${organization.orgUid}, registryId ${organization.registryId}).`,
    );

    logger.debug(
      `5 Last processed index of ${organization.name}: ${auditTableHighestProcessedGenerationIndex}`,
    );
    const lastProcessedRoot = _.get(
      rootHistory,
      `[${auditTableHighestProcessedGenerationIndex}]`,
    );
    logger.debug(
      `6 To be processed index of ${organization.name}: ${toBeProcessedDatalayerGenerationIndex}`,
    );
    const rootToBeProcessed = _.get(
      rootHistory,
      `[${toBeProcessedDatalayerGenerationIndex}]`,
    );

    logger.debug(
      `last processed root of ${organization.name}: ${JSON.stringify(lastProcessedRoot)}`,
    );
    logger.debug(
      `root to be processed of ${organization.name}: ${JSON.stringify(rootToBeProcessed)}`,
    );

    if (!CONFIG.USE_SIMULATOR) {
      // For home org, we can skip sync_status validation since we created the data locally
      // DataLayer may not have processed our own updates yet, which is fine
      if (isHomeOrg) {
        logger.debug(
          `[v1]: Home org sync_status check skipped - data is local (generation=${sync_status?.generation}, target_generation=${sync_status?.target_generation})`,
        );
      } else if (hasUsableSyncStatus(sync_status)) {
        logger.debug(
          `store ${organization.registryId} (${organization.name}) is currently at generation ${sync_status.generation} with a target generation of ${sync_status.target_generation}`,
        );
      } else {
        logger.error(
          `could not get datalayer sync status for store ${organization.registryId} (${organization.name}). pausing sync until sync status can be retrieved`,
        );
        return;
      }

      // Skip generation mismatch check for home org - we trust our own data
      if (!isHomeOrg) {
        const orgRequiredResetDueToInvalidGenerationIndex =
          await orgGenerationMismatchCheck(
            organization.orgUid,
            auditTableHighestProcessedGenerationIndex,
            rootHistoryHighestGenerationIndex,
            sync_status.generation,
            sync_status.target_generation,
          );

        if (orgRequiredResetDueToInvalidGenerationIndex) {
          logger.info(
            `${organization.name} was ahead of datalayer and needed to resync a few generations. trying again shortly...`,
          );
          return;
        }
      }

      // For home org, we don't need to check if DataLayer has caught up - we created the data
      if (
        !isHomeOrg &&
        toBeProcessedDatalayerGenerationIndex > sync_status.generation
      ) {
        const warningMsg = [
          `DataLayer has not locally synced generation index ${toBeProcessedDatalayerGenerationIndex} for ${organization.name} (registry store ${organization.registryId}).`,
          `The highest generation DataLayer has synced is ${sync_status.generation}.`,
          `This issue is often temporary and could be due to a lag in data propagation.`,
          'Syncing for this organization will be paused until this is resolved.',
          'For ongoing issues, please contact the organization.',
        ].join(' ');

        logger.warn(warningMsg);
        return;
      }
    }

    if (!rootToBeProcessed) {
      logger.warn(
        `Generation index ${toBeProcessedDatalayerGenerationIndex} does not exist in ${organization.name} (registry store ${organization.registryId}) root history. Syncing will retry on the next run.`,
      );
      return;
    }

    if (!_.get(rootToBeProcessed, 'confirmed')) {
      logger.info(
        `Waiting for the latest root for ${organization.name} to confirm (orgUid ${organization.orgUid}, registryId ${organization.registryId})`,
      );
      return;
    }

    logger.debug(
      `7 Last processed index of ${organization.name}: ${auditTableHighestProcessedGenerationIndex}`,
    );
    logger.debug(
      `8 To be processed index of ${organization.name}: ${toBeProcessedDatalayerGenerationIndex}`,
    );

    let kvDiff;
    try {
      kvDiff = await datalayer.getRootDiff(
        organization.registryId,
        lastProcessedRoot.root_hash,
        rootToBeProcessed.root_hash,
      );
    } catch (error) {
      logger.warn(
        `DataLayer diff for ${organization.name} generation index ${toBeProcessedDatalayerGenerationIndex} is not ready. Syncing will retry on the next run. Error: ${error.message}`,
      );
      return;
    }

    const comment = kvDiff.filter(
      (diff) =>
        (diff.key === encodeHex('comment') ||
          diff.key === `0x${encodeHex('comment')}`) &&
        diff.type === 'INSERT',
    );

    const author = kvDiff.filter(
      (diff) =>
        (diff.key === encodeHex('author') ||
          diff.key === `0x${encodeHex('author')}`) &&
        diff.type === 'INSERT',
    );

    // This optimizedKvDiff will remove all the DELETES that have corresponding INSERTS
    // This is because we treat INSERTS as UPSERTS and we can save time and reduce DB thrashing
    // by not processing the DELETE for that record.
    const optimizedKvDiff = optimizeAndSortKvDiff(kvDiff);

    const updateAuditTransaction = async (transaction, mirrorTransaction) => {
      logger.info(
        `Syncing ${organization.name} generation ${toBeProcessedDatalayerGenerationIndex} (orgUid ${organization.orgUid}, registryId ${organization.registryId})`,
      );
      if (_.isEmpty(optimizedKvDiff)) {
        const auditData = {
          orgUid: organization.orgUid,
          registryId: organization.registryId,
          rootHash: rootToBeProcessed.root_hash,
          type: 'NO CHANGE',
          table: null,
          change: null,
          onchainConfirmationTimeStamp: rootToBeProcessed.timestamp,
          generation: toBeProcessedDatalayerGenerationIndex,
          comment: '',
          author: '',
        };

        logger.debug(`[v1]: optimized kv diff is empty between ${organization.name} generation indices ${auditTableHighestProcessedGenerationIndex} and ${toBeProcessedDatalayerGenerationIndex}
        (roots [generation ${lastRootSavedToAuditTable.generation}] ${lastProcessedRoot.root_hash} and [generation ${lastRootSavedToAuditTable.generation + 1}] ${rootToBeProcessed.root_hash})`);
        logger.debug(`[v1]: creating audit entry`);
        await Audit.create(auditData, { transaction, mirrorTransaction });
      } else {
        logger.debug(`[v1]: processing optimized kv diff for ${organization.name} generation indices ${auditTableHighestProcessedGenerationIndex} and ${toBeProcessedDatalayerGenerationIndex}
        (roots [generation ${lastRootSavedToAuditTable.generation}] ${lastProcessedRoot.root_hash} and [generation ${lastRootSavedToAuditTable.generation + 1}] ${rootToBeProcessed.root_hash})`);

        // Hoist comment / author parsing out of the per-row diff loop. The
        // comment and author kv-diff entries are shared across every row in
        // the same generation, so re-running tryParseJSON(decodeHex(...)) per
        // row is wasted work proportional to diff length.
        const generationComment = _.get(
          tryParseJSON(decodeHex(_.get(comment, '[0].value', encodeHex('{}')))),
          'comment',
          '',
        );
        const generationAuthor = _.get(
          tryParseJSON(decodeHex(_.get(author, '[0].value', encodeHex('{}')))),
          'author',
          '',
        );

        // Buffer audit rows for a single per-generation bulkCreate at the
        // end of the loop. One INSERT per kv-diff row was the dominant
        // write cost on Pi-class hardware during catch-up.
        const auditRowsForGeneration = [];

        for (const diff of optimizedKvDiff) {
          const key = decodeHex(diff.key);
          const modelKey = key.split('|')[0];
          logger.debug(
            `proccessing kv diff entry for organization ${organization.name} with key ${key}`,
          );

          const auditData = {
            orgUid: organization.orgUid,
            registryId: organization.registryId,
            rootHash: rootToBeProcessed.root_hash,
            type: diff.type,
            table: modelKey,
            change: decodeHex(diff.value),
            onchainConfirmationTimeStamp: rootToBeProcessed.timestamp,
            generation: toBeProcessedDatalayerGenerationIndex,
            comment: generationComment,
            author: generationAuthor,
          };

          if (modelKey && Object.keys(ModelKeys).includes(modelKey)) {
            const record = JSON.parse(decodeHex(diff.value));
            const primaryKeyValue =
              record[ModelKeys[modelKey].primaryKeyAttributes[0]];

            if (diff.type === 'INSERT') {
              logger.verbose(
                `[v1]: UPSERTING: ${modelKey} - ${primaryKeyValue}`,
              );

              // Remove updatedAt fields if they exist
              // This is because the db will update this field automatically and its not allowed to be null
              delete record.updatedAt;

              // if createdAt is null, remove it, so that the db will update it automatically
              // this field is also not allowed to be null
              if (_.isNil(record.createdAt)) {
                delete record.createdAt;
              }

              logger.debug(`[v1]: upserting diff record to ${modelKey} model`);
              await ModelKeys[modelKey].upsert(record, {
                transaction,
                mirrorTransaction,
              });
            } else if (diff.type === 'DELETE') {
              logger.verbose(
                `[v1]: DELETING: ${modelKey} - ${primaryKeyValue}`,
              );
              await ModelKeys[modelKey].destroy({
                where: {
                  [ModelKeys[modelKey].primaryKeyAttributes[0]]:
                    primaryKeyValue,
                },
                transaction,
                mirrorTransaction,
              });
            }
          }

          auditRowsForGeneration.push(auditData);
        }

        if (auditRowsForGeneration.length > 0) {
          logger.debug(
            `[v1]: bulk-writing ${auditRowsForGeneration.length} audit row(s) for generation ${toBeProcessedDatalayerGenerationIndex}`,
          );
          // batchSize caps Sequelize's multi-row INSERT size so a very
          // large generation (rare but possible) does not blow past
          // SQLite's SQLITE_MAX_VARIABLE_NUMBER limit. With ~10 columns
          // per row, 500 rows/batch leaves headroom under the default
          // 32766-variable cap.
          await Audit.bulkCreate(auditRowsForGeneration, {
            transaction,
            mirrorTransaction,
            batchSize: 500,
          });
        }
      }
    };

    if (organization.orgUid === homeOrg?.orgUid) {
      afterCommitCallbacks.push(truncateStaging);
    }

    const transactionSucceeded = await createAndProcessTransaction(
      updateAuditTransaction,
      afterCommitCallbacks,
    );

    if (transactionSucceeded) {
      logger.debug(
        `updateAuditTransaction successfully completed and committed audit updates for ${organization.name} (orgUid: ${organization.orgUid}, registryId: ${organization.registryId}) generation index ${toBeProcessedDatalayerGenerationIndex}. updating registry hash to ${rootToBeProcessed.root_hash}`,
      );

      await Organization.update(
        { registryHash: rootToBeProcessed.root_hash },
        {
          where: { orgUid: organization.orgUid },
        },
      );
    } else {
      logger.debug(
        `updateAuditTransaction failed to complete and commit audit updates for ${organization.name} (orgUid: ${organization.orgUid}, registryId: ${organization.registryId}) generation index ${toBeProcessedDatalayerGenerationIndex}`,
      );
    }
  } catch (error) {
    logger.error('[v1]: Error syncing org audit', error);
  }
};

/**
 * checks if an organization's generations are ahead of needs to be reset , and performs the reset. notifies the caller that the
 * org was reset.
 *
 * datalayer store singletons can lose generation indexes due to blockchain reorgs. while the data is intact, in datalayer
 * and cadt, this effectively makes the last synced cadt generation a 'future' generation, which causes problems.
 *
 * if the DL store is synced, and the cadt generation is higher than the DL generation, the org is resynced to 2 generations
 * back from the highest DL generation
 * @param orgUid
 * @param cadtLastProcessedGenerationIndex
 * @param registryStoreSyncGeneration
 * @param registryStoreHighestRootHistoryIndex
 * @param registryStoreSyncTargetGeneration
 * @return {Promise<boolean>}
 */
const orgGenerationMismatchCheck = async (
  orgUid,
  cadtLastProcessedGenerationIndex,
  registryStoreHighestRootHistoryIndex,
  registryStoreSyncGeneration,
  registryStoreSyncTargetGeneration,
) => {
  const storeSynced =
    registryStoreSyncGeneration === registryStoreSyncTargetGeneration;
  const lastProcessedGenerationIndexDoesNotExistInDatalayer =
    cadtLastProcessedGenerationIndex > registryStoreHighestRootHistoryIndex;
  logger.debug(
    `orgGenerationMismatchCheck() data layer registry store synced: ${storeSynced}, last cadt generation exists in data layer: ${!lastProcessedGenerationIndexDoesNotExistInDatalayer}`,
  );

  if (storeSynced && lastProcessedGenerationIndexDoesNotExistInDatalayer) {
    const resetToGeneration = registryStoreSyncGeneration - 2; // -2 to have a margin
    logger.info(
      `resetting org with orgUid ${orgUid} to generation ${resetToGeneration}`,
    );

    await Audit.resetToGeneration(resetToGeneration, orgUid);
    return true;
  } else {
    return false;
  }
};

export default job;
