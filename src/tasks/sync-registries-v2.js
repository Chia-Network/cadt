import _ from 'lodash';

import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { OrganizationsV2, AuditV2, StagingV2 } from '../models/v2/index.js';
import { ModelKeysV2, getV2PrimaryKeyField } from '../utils/v2-model-utils.js';
import datalayer from '../datalayer';
import {
  decodeHex,
  encodeHex,
  optimizeAndSortKvDiff,
  isOwnedStoreLocalDataMissing,
} from '../utils/datalayer-utils';
import dotenv from 'dotenv';
import { loggerV2 } from '../config/logger.js';
import { sequelizeV2 } from '../database/v2/index.js';
import { getConfig } from '../utils/config-loader';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import {
  processingSyncRegistriesTransactionMutexV2,
  syncRegistriesTaskMutexV2,
} from '../utils/v2-model-utils.js';
import { SyncMismatchBackoff } from '../utils/sync-mismatch-backoff.js';

dotenv.config({ quiet: true });
const CONFIG = getConfig().APP;

const mismatchBackoff = new SyncMismatchBackoff(loggerV2, '[v2]');

const hasUsableSyncStatus = (syncStatus) =>
  syncStatus?.generation != null && syncStatus?.target_generation != null;

const task = new Task('sync-registries-v2', async () => {
  loggerV2.debug('[v2]: sync registries v2 task invoked');
  if (!syncRegistriesTaskMutexV2.isLocked()) {
    const releaseSyncTaskMutex = await syncRegistriesTaskMutexV2.acquire();
    try {
      await processJob();
    } catch (error) {
      loggerV2.error(`[v2]: Error during V2 datasync: ${error.message}`);
      console.trace(error);

      // Log additional information if present in the error object
      if (error.response && error.response.body) {
        loggerV2.error(
          `[v2]: Additional error details: ${JSON.stringify(error.response.body)}`,
        );
      }
    } finally {
      releaseSyncTaskMutex();
    }
  } else {
    loggerV2.debug(
      '[v2]: could not acquire sync registries v2 mutex. trying again shortly',
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG.USE_SIMULATOR ? 1 : 5,
    runImmediately: true,
  },
  task,
  { id: 'sync-registries-v2', preventOverrun: true },
);

const processJob = async () => {
  await assertDataLayerAvailable();
  await assertWalletIsSynced();

  loggerV2.debug('[v2]: running sync-registries-v2 processJob()');
  loggerV2.debug('[v2]: querying organization model');
  const organizations = await OrganizationsV2.findAll({
    where: { subscribed: true },
    raw: true,
  });

  for (const organization of organizations) {
    await syncOrganizationAuditV2(organization);
  }
};

const tryParseJSON = (jsonString, defaultValue) => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
};

const truncateStagingV2 = async () => {
  loggerV2.info('[v2]: ATTEMPTING TO CLEAN COMMITTED STAGING RECORDS');

  let success = false;
  let attempts = 0;
  const maxAttempts = 5; // Set a maximum number of attempts to avoid infinite loops

  while (!success && attempts < maxAttempts) {
    try {
      // Only delete records that have been marked as committed.
      // This prevents deleting newly staged records that haven't been committed yet.
      // Exclude is_transfer records: project transfers are staged with
      // committed: true + is_transfer: true and must persist until the offer
      // flow consumes them (see staging-v2.model generateOfferFile and the
      // offer controller). They are cleaned up explicitly by the offer flow,
      // not by this periodic task.
      await StagingV2.destroy({
        where: {
          committed: true,
          is_transfer: false,
        },
      });
      success = true; // If destroy succeeds, set success to true to exit the loop
      loggerV2.info('[v2]: COMMITTED STAGING RECORDS CLEANED SUCCESSFULLY');
    } catch (error) {
      attempts++;
      loggerV2.error(
        `[v2]: TRUNCATION FAILED ON ATTEMPT ${attempts}: ${error.message}`,
      );
      if (attempts < maxAttempts) {
        loggerV2.info('[v2]: WAITING 1 SECOND BEFORE RETRYING...');
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
      } else {
        loggerV2.error('[v2]: MAXIMUM TRUNCATION ATTEMPTS REACHED, GIVING UP');
      }
    }
  }
};

const syncOrganizationAuditV2 = async (organization) => {
  loggerV2.debug(`syncing organization audit for ${organization.name}`);
  try {
    let afterCommitCallbacks = [];

    loggerV2.debug('querying organization model for home org');
    const homeOrg = await OrganizationsV2.getHomeOrg();

    // Check if registry_id is set
    if (!organization.registry_id) {
      loggerV2.warn(
        `[v2]: Organization ${organization.name} (orgUid ${organization.org_uid}) has no registry_id set. Cannot sync.`,
      );
      return;
    }

    loggerV2.debug(`querying datalayer for ${organization.name} root history`);
    const rootHistory = await datalayer.getRootHistory(
      organization.registry_id,
    );
    loggerV2.debug(`querying datalayer for ${organization.name} sync status`);
    const syncResult = await datalayer.getDataLayerStoreSyncStatus(
      organization.registry_id,
    );
    const sync_status = syncResult?.sync_status;

    // Log diagnostic info for debugging
    loggerV2.debug(
      `[v2]: [SYNC_DIAG] ${organization.name}: registry_id=${organization.registry_id}, ` +
        `rootHistory.length=${rootHistory?.length || 0}, ` +
        `sync_status.generation=${sync_status?.generation}, ` +
        `sync_status.target_generation=${sync_status?.target_generation}`,
    );

    if (!rootHistory?.length) {
      loggerV2.warn(
        `Could not find root history for ${organization.name} (orgUid ${organization.org_uid}, registryId ${organization.registry_id}), something is wrong and the sync for this organization will be paused until this is resolved.`,
      );
      return;
    }

    // For home org, skip the sync_status check - our own data is already local
    // The sync_status might lag behind because datalayer is still processing our own updates
    const isHomeOrg = homeOrg && organization.org_uid === homeOrg.org_uid;

    if (
      process.env.NODE_ENV !== 'test' &&
      !isHomeOrg &&
      mismatchBackoff.shouldSkip({
        orgId: organization.org_uid,
        orgName: organization.name,
        rootHistoryLength: rootHistory.length,
        generation: sync_status?.generation,
        targetGeneration: sync_status?.target_generation,
      })
    ) {
      return;
    }

    mismatchBackoff.clearIfResolved(organization.org_uid, organization.name);

    // For home org, log if there's a mismatch but proceed anyway
    if (isHomeOrg && rootHistory.length - 1 !== sync_status?.generation) {
      if (isOwnedStoreLocalDataMissing(sync_status)) {
        loggerV2.error(
          `[v2]: CRITICAL: DataLayer store for ${organization.name} (${organization.registry_id}) has lost its local data. ` +
            `sync_status.generation=0 with empty root hash, but blockchain shows target_generation=${sync_status.target_generation}. ` +
            `The DataLayer database was likely deleted or reset. ` +
            `DO NOT commit new data until this is resolved -- DataLayer will silently discard it.`,
        );
      } else {
        loggerV2.debug(
          `[v2]: Home org sync_status lag (rootHistory.length-1=${rootHistory.length - 1} vs generation=${sync_status?.generation}), proceeding anyway as data is local`,
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
      lastRootSavedToAuditTable.root_hash = lastRootSavedToAuditTable.root_hash;
      lastRootSavedToAuditTable.generation = 0;
    } else {
      loggerV2.debug(
        `querying audit table for last root of ${organization.name}`,
      );
      lastRootSavedToAuditTable = await AuditV2.findOne({
        where: { registry_id: organization.registry_id },
        order: [['generation', 'DESC']],
        raw: true,
      });

      if (lastRootSavedToAuditTable) {
        // Map V2 field names
        lastRootSavedToAuditTable.timestamp = Number(
          lastRootSavedToAuditTable?.onchain_confirmation_time_stamp || 0,
        );
        lastRootSavedToAuditTable.root_hash =
          lastRootSavedToAuditTable.root_hash;
      }
    }

    const highestStoreGeneration = _.get(rootHistory, '[0]');

    if (!lastRootSavedToAuditTable) {
      loggerV2.info(
        `Syncing new registry ${organization.name} (orgUid ${organization.org_uid}, registryId ${organization.registry_id})`,
      );

      // Validate that highestStoreGeneration exists and has required fields
      if (!highestStoreGeneration || !highestStoreGeneration.root_hash) {
        loggerV2.error(
          `[v2]: Cannot create CREATE REGISTRY audit entry - root history is empty or missing root_hash for ${organization.name}`,
        );
        return;
      }

      // Ensure timestamp exists, use current time if missing
      const timestamp = highestStoreGeneration.timestamp
        ? highestStoreGeneration.timestamp.toString()
        : Math.floor(Date.now() / 1000).toString();

      loggerV2.debug("creating 'CREATE REGISTRY' audit entry");
      await AuditV2.create({
        org_uid: organization.org_uid,
        registry_id: organization.registry_id,
        root_hash: highestStoreGeneration.root_hash,
        type: 'CREATE REGISTRY',
        generation: 0,
        change: null,
        table: null,
        onchain_confirmation_time_stamp: timestamp,
      });

      // Destroy existing records for this singleton
      // On a fresh db this does nothing, but when the audit table
      // is reset this will ensure that this organizations registry data is
      // cleaned up and ready to resync
      await Promise.all(
        Object.keys(ModelKeysV2).map(async (modelKey) => {
          loggerV2.debug(
            `performing destroy operation on organization data in model ${modelKey}`,
          );
          // Note: V2 models don't have org_uid field (except AuditV2)
          // Records are associated with organizations through the registry, not directly
          // So we don't need to delete by org_uid for V2 data models
        }),
      );

      return;
    }

    const auditTableHighestProcessedGenerationIndex =
      lastRootSavedToAuditTable.generation; // generation -> generation INDEX
    loggerV2.debug(
      `1 Last processed generation index of ${organization.name}: ${auditTableHighestProcessedGenerationIndex}`,
    );

    const rootHistoryHighestGenerationIndex = rootHistory.length - 1;
    const syncRemaining =
      Math.abs(rootHistoryHighestGenerationIndex) -
      Math.abs(auditTableHighestProcessedGenerationIndex);
    const isSynced = syncRemaining === 0;

    loggerV2.debug(
      `[SYNC DEBUG] ${organization.name}: rootHistory.length=${rootHistory.length}, ` +
        `auditGeneration=${auditTableHighestProcessedGenerationIndex}, ` +
        `rootHistoryHighestIndex=${rootHistoryHighestGenerationIndex}, ` +
        `syncRemaining=${syncRemaining}, isSynced=${isSynced}`,
    );

    loggerV2.debug(
      `2 the root history length for ${organization.name} is ${rootHistory.length} and the last processed generation index is ${auditTableHighestProcessedGenerationIndex}`,
    );
    loggerV2.debug(
      `2 the highest root history index is ${rootHistoryHighestGenerationIndex}, given this and the last processed index, the number of generations left to sync is ${syncRemaining}`,
    );
    loggerV2.debug(
      `updating organization model with new sync status for ${organization.name}`,
    );
    await OrganizationsV2.update(
      {
        synced: isSynced,
        sync_remaining: syncRemaining,
      },
      { where: { org_uid: organization.org_uid } },
    );

    if (process.env.NODE_ENV !== 'test' && isSynced) {
      loggerV2.debug(
        `${organization.name}: is synced. the last processed index is ${auditTableHighestProcessedGenerationIndex} and the highest root history index is ${rootHistoryHighestGenerationIndex}`,
      );
      return;
    }

    const toBeProcessedDatalayerGenerationIndex =
      auditTableHighestProcessedGenerationIndex + 1;
    loggerV2.debug(
      `3 Last processed generation index of ${organization.name}: ${auditTableHighestProcessedGenerationIndex}`,
    );
    loggerV2.debug(
      `4 To be processed generation index of ${organization.name}: ${toBeProcessedDatalayerGenerationIndex}`,
    );

    // Organization not synced, sync it
    loggerV2.info(' ');
    loggerV2.info(
      `Syncing ${organization.name} generation index ${toBeProcessedDatalayerGenerationIndex} (orgUid ${organization.org_uid}, registryId ${organization.registry_id})`,
    );
    loggerV2.info(
      `${organization.name} is ${syncRemaining} DataLayer generations away from being fully synced (orgUid ${organization.org_uid}, registryId ${organization.registry_id}).`,
    );

    loggerV2.debug(
      `5 Last processed index of ${organization.name}: ${auditTableHighestProcessedGenerationIndex}`,
    );
    const lastProcessedRoot = _.get(
      rootHistory,
      `[${auditTableHighestProcessedGenerationIndex}]`,
    );
    loggerV2.debug(
      `6 To be processed index of ${organization.name}: ${toBeProcessedDatalayerGenerationIndex}`,
    );
    const rootToBeProcessed = _.get(
      rootHistory,
      `[${toBeProcessedDatalayerGenerationIndex}]`,
    );

    loggerV2.debug(
      `last processed root of ${organization.name}: ${JSON.stringify(lastProcessedRoot)}`,
    );
    loggerV2.debug(
      `root to be processed of ${organization.name}: ${JSON.stringify(rootToBeProcessed)}`,
    );

    if (!CONFIG.USE_SIMULATOR) {
      // For home org, we can skip sync_status validation since we created the data locally
      // DataLayer may not have processed our own updates yet, which is fine
      if (isHomeOrg) {
        loggerV2.debug(
          `[v2]: Home org sync_status check skipped - data is local (generation=${sync_status?.generation}, target_generation=${sync_status?.target_generation})`,
        );
      } else if (hasUsableSyncStatus(sync_status)) {
        loggerV2.debug(
          `store ${organization.registry_id} (${organization.name}) is currently at generation ${sync_status.generation} with a target generation of ${sync_status.target_generation}`,
        );
      } else {
        loggerV2.error(
          `could not get datalayer sync status for store ${organization.registry_id} (${organization.name}). pausing sync until sync status can be retrieved`,
        );
        return;
      }

      // Skip generation mismatch check for home org - we trust our own data
      if (!isHomeOrg) {
        const orgRequiredResetDueToInvalidGenerationIndex =
          await orgGenerationMismatchCheckV2(
            organization.org_uid,
            auditTableHighestProcessedGenerationIndex,
            rootHistoryHighestGenerationIndex,
            sync_status.generation,
            sync_status.target_generation,
          );

        if (orgRequiredResetDueToInvalidGenerationIndex) {
          loggerV2.info(
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
          `DataLayer has not locally synced generation index ${toBeProcessedDatalayerGenerationIndex} for ${organization.name} (registry store ${organization.registry_id}).`,
          `The highest generation DataLayer has synced is ${sync_status.generation}.`,
          `This issue is often temporary and could be due to a lag in data propagation.`,
          'Syncing for this organization will be paused until this is resolved.',
          'For ongoing issues, please contact the organization.',
        ].join(' ');

        loggerV2.warn(warningMsg);
        return;
      }
    }

    if (!rootToBeProcessed) {
      loggerV2.warn(
        `Generation index ${toBeProcessedDatalayerGenerationIndex} does not exist in ${organization.name} (registry store ${organization.registry_id}) root history. Syncing will retry on the next run.`,
      );
      return;
    }

    if (!_.get(rootToBeProcessed, 'confirmed')) {
      loggerV2.info(
        `Waiting for the latest root for ${organization.name} to confirm (orgUid ${organization.org_uid}, registryId ${organization.registry_id})`,
      );
      return;
    }

    loggerV2.debug(
      `7 Last processed index of ${organization.name}: ${auditTableHighestProcessedGenerationIndex}`,
    );
    loggerV2.debug(
      `8 To be processed index of ${organization.name}: ${toBeProcessedDatalayerGenerationIndex}`,
    );

    let kvDiff;
    try {
      kvDiff = await datalayer.getRootDiff(
        organization.registry_id,
        lastProcessedRoot.root_hash,
        rootToBeProcessed.root_hash,
      );
    } catch (error) {
      loggerV2.warn(
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

    const updateAuditTransaction = async (transaction) => {
      loggerV2.info(
        `Syncing ${organization.name} generation ${toBeProcessedDatalayerGenerationIndex} (orgUid ${organization.org_uid}, registryId ${organization.registry_id})`,
      );

      loggerV2.debug('[v2]: updateAuditTransaction - optimizedKvDiff details', {
        orgName: organization.name,
        diffCount: optimizedKvDiff.length,
        isEmpty: _.isEmpty(optimizedKvDiff),
        sampleDiffs: optimizedKvDiff.slice(0, 3).map((d) => ({
          type: d.type,
          key: d.key?.substring(0, 30),
        })),
      });

      if (_.isEmpty(optimizedKvDiff)) {
        const auditData = {
          org_uid: organization.org_uid,
          registry_id: organization.registry_id,
          root_hash: rootToBeProcessed.root_hash,
          type: 'NO CHANGE',
          table: null,
          change: null,
          onchain_confirmation_time_stamp:
            rootToBeProcessed.timestamp?.toString() ||
            Math.floor(Date.now() / 1000).toString(),
          generation: toBeProcessedDatalayerGenerationIndex,
          comment: '',
          author: '',
        };

        loggerV2.debug(
          `optimized kv diff is empty between ${organization.name} generation indices ${auditTableHighestProcessedGenerationIndex} and ${toBeProcessedDatalayerGenerationIndex}
        (roots [generation ${lastRootSavedToAuditTable.generation}] ${lastProcessedRoot.root_hash} and [generation ${lastRootSavedToAuditTable.generation + 1}] ${rootToBeProcessed.root_hash})`,
        );
        loggerV2.debug('creating audit entry');
        await AuditV2.create(auditData, { transaction });
      } else {
        loggerV2.debug(
          `processing optimized kv diff for ${organization.name} generation indices ${auditTableHighestProcessedGenerationIndex} and ${toBeProcessedDatalayerGenerationIndex}
        (roots [generation ${lastRootSavedToAuditTable.generation}] ${lastProcessedRoot.root_hash} and [generation ${lastRootSavedToAuditTable.generation + 1}] ${rootToBeProcessed.root_hash})`,
        );

        for (const diff of optimizedKvDiff) {
          const key = decodeHex(diff.key);
          const modelKey = key.split('|')[0];

          loggerV2.debug(
            `processing kv diff entry for organization ${organization.name} with key ${key}, model: ${modelKey}, action: ${diff.type}`,
          );

          const auditData = {
            org_uid: organization.org_uid,
            registry_id: organization.registry_id,
            root_hash: rootToBeProcessed.root_hash,
            type: diff.type,
            table: modelKey,
            change: diff.value ? decodeHex(diff.value) : null, // DELETE operations don't have a value field
            onchain_confirmation_time_stamp:
              rootToBeProcessed.timestamp?.toString() ||
              Math.floor(Date.now() / 1000).toString(),
            generation: toBeProcessedDatalayerGenerationIndex,
            comment: _.get(
              tryParseJSON(
                decodeHex(_.get(comment, '[0].value', encodeHex('{}'))),
              ),
              'comment',
              '',
            ),
            author: _.get(
              tryParseJSON(
                decodeHex(_.get(author, '[0].value', encodeHex('{}'))),
              ),
              'author',
              '',
            ),
          };

          if (modelKey && Object.keys(ModelKeysV2).includes(modelKey)) {
            const primaryKeyField = getV2PrimaryKeyField(modelKey);
            const primaryKeyFieldCamelCase = _.camelCase(primaryKeyField);

            if (diff.type === 'INSERT' || diff.type === 'UPDATE') {
              const record = JSON.parse(decodeHex(diff.value));
              // Convert snake_case field names from datalayer to camelCase for Sequelize
              // V2 models use underscored: true, which means Sequelize expects camelCase in JS
              const camelCaseRecord = _.mapKeys(record, (_value, key) => {
                // Convert snake_case to camelCase
                return _.camelCase(key);
              });
              const primaryKeyValue =
                camelCaseRecord[primaryKeyFieldCamelCase] ||
                record[primaryKeyField];

              loggerV2.verbose(
                `UPSERTING (${diff.type}): ${modelKey} - ${primaryKeyValue}`,
              );

              // Remove updatedAt/updated_at fields if they exist
              // This is because the db will update this field automatically and its not allowed to be null
              delete camelCaseRecord.updatedAt;
              delete camelCaseRecord.updated_at;

              // if createdAt/created_at is null, remove it, so that the db will update it automatically
              // this field is also not allowed to be null
              if (_.isNil(camelCaseRecord.createdAt)) {
                delete camelCaseRecord.createdAt;
              }
              if (_.isNil(camelCaseRecord.created_at)) {
                delete camelCaseRecord.created_at;
              }

              loggerV2.debug(`upserting diff record to ${modelKey} model`, {
                modelKey,
                primaryKeyField,
                primaryKeyFieldCamelCase,
                primaryKeyValue,
                recordKeys: Object.keys(camelCaseRecord),
                recordSample: _.pick(camelCaseRecord, [
                  primaryKeyFieldCamelCase,
                  'methodologyCode',
                  'methodologyName',
                ]),
              });
              try {
                await ModelKeysV2[modelKey].upsert(camelCaseRecord, {
                  transaction,
                });
              } catch (upsertError) {
                loggerV2.error(`Failed to upsert ${modelKey} record`, {
                  modelKey,
                  primaryKeyValue,
                  error: upsertError.message,
                  errorName: upsertError.name,
                  sequelizeErrors: upsertError.errors,
                  record: camelCaseRecord,
                });
                throw upsertError;
              }
            } else if (diff.type === 'DELETE') {
              // For DELETE operations, extract primary key value from the key field
              // Key format is: "project|{uuid}" or "co_benefit|{uuid}" or "project_methodology|{uuid}"
              const keyParts = key.split('|');
              if (keyParts.length < 2) {
                loggerV2.error(
                  `Invalid DELETE key format: ${key}. Expected format: "table|id"`,
                );
                continue;
              }
              const primaryKeyValue = keyParts.slice(1).join('|'); // Handle cases where UUID might contain '|'

              loggerV2.debug(
                `[v2]: [DELETE SYNC DEBUG] Processing DELETE operation from datalayer`,
                {
                  modelKey,
                  decodedKey: key,
                  hexKey: diff.key,
                  primaryKeyValue,
                  keyParts,
                  organization: organization.name,
                  generationIndex: toBeProcessedDatalayerGenerationIndex,
                },
              );

              loggerV2.verbose(`DELETING: ${modelKey} - ${primaryKeyValue}`);

              // Use the primary key field directly
              const whereClause = {
                [primaryKeyFieldCamelCase]: primaryKeyValue,
              };

              await ModelKeysV2[modelKey].destroy({
                where: whereClause,
                transaction,
              });
            }
          }

          // Create the Audit record
          loggerV2.debug('writing change record ');
          await AuditV2.create(auditData, { transaction });
        }
      }
    };

    if (organization.org_uid === homeOrg?.org_uid) {
      afterCommitCallbacks.push(truncateStagingV2);
    }

    const transactionSucceeded = await createAndProcessTransactionV2(
      updateAuditTransaction,
      afterCommitCallbacks,
    );

    if (transactionSucceeded) {
      loggerV2.info('[v2]: syncOrganizationGenerationV2 COMPLETED', {
        orgName: organization.name,
        orgUid: organization.org_uid,
        registryId: organization.registry_id,
        generationIndex: toBeProcessedDatalayerGenerationIndex,
        rootHash: rootToBeProcessed.root_hash,
        diffCount: optimizedKvDiff.length,
      });

      loggerV2.debug(
        `updateAuditTransaction successfully completed and committed audit updates for ${organization.name} (orgUid: ${organization.org_uid}, registryId: ${organization.registry_id}) generation index ${toBeProcessedDatalayerGenerationIndex}. updating registry hash to ${rootToBeProcessed.root_hash}`,
      );

      await OrganizationsV2.update(
        { registry_hash: rootToBeProcessed.root_hash },
        {
          where: { org_uid: organization.org_uid },
        },
      );
    } else {
      loggerV2.debug(
        `updateAuditTransaction failed to complete and commit audit updates for ${organization.name} (orgUid: ${organization.org_uid}, registryId: ${organization.registry_id}) generation index ${toBeProcessedDatalayerGenerationIndex}`,
      );
    }
  } catch (error) {
    loggerV2.error('Error syncing org audit', error);
  }
};

async function createAndProcessTransactionV2(callback, afterCommitCallbacks) {
  let transaction;

  loggerV2.info(
    'Starting sequelize V2 transaction and acquiring transaction mutex',
  );
  const releaseTransactionMutex =
    await processingSyncRegistriesTransactionMutexV2.acquire();

  try {
    // Start a transaction
    transaction = await sequelizeV2.transaction();

    // Execute the provided callback with the transaction
    await callback(transaction);

    // Commit the transaction if the callback completes without errors
    await transaction.commit();

    for (const afterCommitCallback of afterCommitCallbacks) {
      await afterCommitCallback();
    }

    loggerV2.info('Committed sequelize V2 transaction');

    return true;
  } catch (error) {
    // Roll back the transaction if an error occurs
    if (transaction) {
      loggerV2.error(
        `encountered error syncing organization audit. Rolling back transaction. Error: ${error.message}`,
        {
          error: error.name,
          message: error.message,
          stack: error.stack,
          ...(error.errors && { sequelizeErrors: error.errors }),
        },
      );
      await transaction.rollback();
      return false;
    }
  } finally {
    releaseTransactionMutex();
  }
}

/**
 * checks if an organization's generations are ahead of needs to be reset , and performs the reset. notifies the caller that the
 * org was reset.
 *
 * datalayer store singletons can lose generation indexes due to blockchain reorgs. while the data is intact, in datalayer
 * and cadt, this effectively makes the last synced cadt generation a 'future' generation, which causes problems.
 *
 * if the DL store is synced, and the cadt generation is higher than the DL generation, the org is resynced to 2 generations
 * back from the highest DL generation
 * @param {string} orgUid
 * @param {number} cadtLastProcessedGenerationIndex
 * @param {number} registryStoreHighestRootHistoryIndex
 * @param {number} registryStoreSyncGeneration
 * @param {number} registryStoreSyncTargetGeneration
 * @return {Promise<boolean>}
 */
const orgGenerationMismatchCheckV2 = async (
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
  loggerV2.debug(
    `orgGenerationMismatchCheckV2() data layer registry store synced: ${storeSynced}, last cadt generation exists in data layer: ${!lastProcessedGenerationIndexDoesNotExistInDatalayer}`,
  );

  if (storeSynced && lastProcessedGenerationIndexDoesNotExistInDatalayer) {
    const resetToGeneration = registryStoreSyncGeneration - 2; // -2 to have a margin
    loggerV2.info(
      `resetting org with orgUid ${orgUid} to generation ${resetToGeneration}`,
    );

    await AuditV2.resetToGeneration(orgUid, resetToGeneration);
    return true;
  } else {
    return false;
  }
};

export default job;
