import _ from 'lodash';

import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization, Audit, ModelKeys, Staging, Meta } from '../models';
import datalayer from '../datalayer';
import {
  decodeHex,
  encodeHex,
  optimizeAndSortKvDiff,
} from '../utils/datalayer-utils';
import dotenv from 'dotenv';
import { logger } from '../logger';
import { sequelize, sequelizeMirror } from '../database';
import { CONFIG } from '../user-config';
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

dotenv.config();

const task = new Task('sync-registries', async () => {
  logger.debug('sync registries task invoked');
  if (!syncRegistriesTaskMutex.isLocked()) {
    const releaseSyncTaskMutex = await syncRegistriesTaskMutex.acquire();
    try {
      const hasMigratedToNewSyncMethod = await Meta.findOne({
        where: { metaKey: 'migratedToNewSync' },
      });

      const hasMigratedToGenerationIndexSync = await Meta.findOne({
        where: { metaKey: 'migratedToIndexBasedSync' },
      });

      if (hasMigratedToNewSyncMethod || CONFIG().CADT.USE_SIMULATOR) {
        if (hasMigratedToGenerationIndexSync) {
          await processJob();
        } else {
          await generateGenerationIndex();
        }
      } else {
        await migrateToNewSync();
      }
    } catch (error) {
      logger.error(`Error during datasync: ${error.message}`);

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
    seconds: 10,
    runImmediately: true,
  },
  task,
  { id: 'sync-registries', preventOverrun: true },
);

const processJob = async () => {
  await assertDataLayerAvailable();
  await assertWalletIsSynced();

  logger.debug(`running sync-registries proccessJob()`);
  logger.debug(`querying organization model`);

  const organizations = await Organization.findAll({
    where: { subscribed: true },
    raw: true,
  });

  for (const organization of organizations) {
    if (CONFIG().CADT.USE_SIMULATOR || process.env.NODE_ENV === 'test') {
      await syncOrganizationAudit(organization);
    } else {
      const mostRecentOrgAuditRecord = await Audit.findOne({
        where: {
          orgUid: organization.orgUid,
        },
        order: [['createdAt', 'DESC']],
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
};

async function createAndProcessTransaction(callback, afterCommitCallbacks) {
  let transaction;
  let mirrorTransaction;

  logger.info('Starting sequelize transaction and acquiring transaction mutex');
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

    logger.info('Commited sequelize transaction');

    return true;
  } catch (error) {
    // Roll back the transaction if an error occurs
    if (transaction) {
      logger.error(
        `encountered error syncing organization audit. Rolling back transaction. Error: ${error}`,
      );
      await transaction.rollback();
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
  logger.info(`ATTEMPTING TO TRUNCATE STAGING TABLE`);

  let success = false;
  let attempts = 0;
  const maxAttempts = 5; // Set a maximum number of attempts to avoid infinite loops

  while (!success && attempts < maxAttempts) {
    try {
      await Staging.truncate();
      success = true; // If truncate succeeds, set success to true to exit the loop
      logger.info('STAGING TABLE TRUNCATED SUCCESSFULLY');
    } catch (error) {
      attempts++;
      logger.error(
        `TRUNCATION FAILED ON ATTEMPT ${attempts}: ${error.message}`,
      );
      if (attempts < maxAttempts) {
        logger.info('WAITING 1 SECOND BEFORE RETRYING...');
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
      } else {
        logger.error('MAXIMUM TRUNCATION ATTEMPTS REACHED, GIVING UP');
      }
    }
  }
};

const syncOrganizationAudit = async (organization) => {
  logger.debug(`syncing organization audit for ${organization.name}`);
  try {
    let afterCommitCallbacks = [];

    logger.debug(`querying organization model for home org`);
    const homeOrg = await Organization.getHomeOrg();
    logger.debug(`querying datalayer for ${organization.name} root history`);
    const rootHistory = await datalayer.getRootHistory(organization.registryId);
    logger.debug(`querying datalayer for ${organization.name} sync status`);
    const { sync_status } = await datalayer.getSyncStatus(
      organization.registryId,
    );

    if (!rootHistory?.length) {
      logger.warn(
        `Could not find root history for ${organization.name} (orgUid ${organization.orgUid}, registryId ${organization.registryId}), something is wrong and the sync for this organization will be paused until this is resolved.`,
      );
      return;
    }

    if (
      process.env.NODE_ENV !== 'test' &&
      rootHistory.length - 1 !== sync_status?.generation
    ) {
      logger.warn(
        `the root history length does not match the number of synced generations for ${organization.name} (registry store Id ${organization.registryId}). pausing the sync for this organization until the root history length and number of synced generations match`,
      );
      return;
    } else if (
      process.env.NODE_ENV !== 'test' &&
      rootHistory.length - 1 !== sync_status?.target_generation
    ) {
      logger.debug(
        `the root history length does not match the target generation number for ${organization.name} (registry store Id ${organization.registryId}). something is wrong and the sync for this organization will be paused until this is resolved. `,
      );
      return;
    }

    /**
     * IMPORTANT: audit data 'generation' field is a generation INDEX, not the actual generation number
     */
    let lastRootSavedToAuditTable;

    if (CONFIG().CADT.USE_SIMULATOR) {
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

      logger.debug(`creating 'CREATE REGISTRY' audit entry`);
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
    logger.info(' ');
    logger.info(
      `Syncing ${organization.name} generation index ${toBeProcessedDatalayerGenerationIndex} (orgUid ${organization.orgUid}, registryId ${organization.registryId})`,
    );
    logger.info(
      `${organization.name} is ${syncRemaining} DataLayer generations away from being fully synced (orgUid ${organization.orgUid}, registryId ${organization.registryId}).`,
    );

    if (!CONFIG().CADT.USE_SIMULATOR) {
      await new Promise((resolve) => setTimeout(resolve, 30000));

      if (
        sync_status &&
        sync_status?.generation &&
        sync_status?.target_generation
      ) {
        logger.debug(
          `store ${organization.registryId} (${organization.name}) is currently at generation ${sync_status.generation} with a target generation of ${sync_status.target_generation}`,
        );
      } else {
        logger.error(
          `could not get datalayer sync status for store ${organization.registryId} (${organization.name}). pausing sync until sync status can be retrieved`,
        );
        return;
      }

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

      if (toBeProcessedDatalayerGenerationIndex > sync_status.generation) {
        const warningMsg = [
          `Generation ${toBeProcessedDatalayerGenerationIndex + 1} does not exist in ${organization.name} (registry store ${organization.registryId}) root history`,
          `DataLayer not yet caught up to generation ${auditTableHighestProcessedGenerationIndex + 1}. The the highest generation datalayer has synced is ${sync_status.generation}.`,
          `This issue is often temporary and could be due to a lag in data propagation.`,
          'Syncing for this organization will be paused until this is resolved.',
          'For ongoing issues, please contact the organization.',
        ].join(' ');

        logger.warn(warningMsg);
        return;
      }
    }

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

    const kvDiff = await datalayer.getRootDiff(
      organization.registryId,
      lastProcessedRoot.root_hash,
      rootToBeProcessed.root_hash,
    );

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

        logger.debug(`optimized kv diff is empty between ${organization.name} generation indices ${auditTableHighestProcessedGenerationIndex} and ${toBeProcessedDatalayerGenerationIndex}
        (roots [generation ${lastRootSavedToAuditTable.generation}] ${lastProcessedRoot.root_hash} and [generation ${lastRootSavedToAuditTable.generation + 1}] ${rootToBeProcessed.root_hash})`);
        logger.debug(`creating audit entry`);
        await Audit.create(auditData, { transaction, mirrorTransaction });
      } else {
        logger.debug(`processing optimized kv diff for ${organization.name} generation indices ${auditTableHighestProcessedGenerationIndex} and ${toBeProcessedDatalayerGenerationIndex}
        (roots [generation ${lastRootSavedToAuditTable.generation}] ${lastProcessedRoot.root_hash} and [generation ${lastRootSavedToAuditTable.generation + 1}] ${rootToBeProcessed.root_hash})`);

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

          if (modelKey && Object.keys(ModelKeys).includes(modelKey)) {
            const record = JSON.parse(decodeHex(diff.value));
            const primaryKeyValue =
              record[ModelKeys[modelKey].primaryKeyAttributes[0]];

            if (diff.type === 'INSERT') {
              logger.task(`UPSERTING: ${modelKey} - ${primaryKeyValue}`);

              // Remove updatedAt fields if they exist
              // This is because the db will update this field automatically and its not allowed to be null
              delete record.updatedAt;

              // if createdAt is null, remove it, so that the db will update it automatically
              // this field is also not allowed to be null
              if (_.isNil(record.createdAt)) {
                delete record.createdAt;
              }

              logger.debug(`upserting diff record to ${modelKey} model`);

              await ModelKeys[modelKey].upsert(record, {
                transaction,
                mirrorTransaction,
              });
            } else if (diff.type === 'DELETE') {
              logger.task(`DELETING: ${modelKey} - ${primaryKeyValue}`);
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

          // Create the Audit record
          logger.debug(`writing change record `);
          await Audit.create(auditData, { transaction, mirrorTransaction });
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
    logger.error('Error syncing org audit', error);
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
