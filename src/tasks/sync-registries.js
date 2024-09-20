import _ from 'lodash';

import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Mutex } from 'async-mutex';
import { Organization, Audit, ModelKeys, Staging, Meta } from '../models';
import datalayer from '../datalayer';
import {
  decodeHex,
  encodeHex,
  optimizeAndSortKvDiff,
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

dotenv.config();
const mutex = new Mutex();
const CONFIG = getConfig().APP;

const task = new Task('sync-registries', async () => {
  if (!mutex.isLocked()) {
    logger.debug('running sync registries task');
    const releaseMutex = await mutex.acquire();
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
      logger.error(`Error during datasync: ${error.message}`);

      console.trace(error);

      // Log additional information if present in the error object
      if (error.response && error.response.body) {
        logger.error(
          `Additional error details: ${JSON.stringify(error.response.body)}`,
        );
      }
    } finally {
      releaseMutex();
    }
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
    await syncOrganizationAudit(organization);
  }
};

async function createTransaction(callback, afterCommitCallbacks) {
  let result = null;

  let transaction;
  let mirrorTransaction;

  try {
    logger.info('Starting sequelize transaction');
    // Start a transaction
    transaction = await sequelize.transaction();

    if (mirrorDBEnabled()) {
      mirrorTransaction = await sequelizeMirror.transaction();
    }

    // Execute the provided callback with the transaction
    result = await callback(transaction, mirrorTransaction);

    // Commit the transaction if the callback completes without errors
    await transaction.commit();

    if (mirrorDBEnabled()) {
      await mirrorTransaction.commit();
    }

    for (const afterCommitCallback of afterCommitCallbacks) {
      await afterCommitCallback();
    }

    logger.info('Commited sequelize transaction');

    return result;
  } catch (error) {
    // Roll back the transaction if an error occurs
    if (transaction) {
      logger.error('Rolling back transaction');
      console.error(error);
      await transaction.rollback();
    }
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

    if (!rootHistory.length) {
      logger.info(
        `No root history found for ${organization.name} (store ${organization.orgUid})`,
      );
      return;
    }

    let lastRootSaved;

    if (CONFIG.USE_SIMULATOR) {
      console.log('USING MOCK ROOT HISTORY');
      lastRootSaved = rootHistory[0];
      lastRootSaved.rootHash = lastRootSaved.root_hash;
      lastRootSaved.generation = 0;
    } else {
      logger.debug(
        `querying audit table for last root of ${organization.name}`,
      );
      lastRootSaved = await Audit.findOne({
        where: { registryId: organization.registryId },
        order: [['generation', 'DESC']],
        raw: true,
      });

      if (lastRootSaved) {
        // There was an oversight in the audit model where we named it onChainConfirmationTimeStamp but
        // the RPC result calls in timestamp. This is a temporary fix to ensure that we can still sync
        lastRootSaved.timestamp = Number(
          lastRootSaved?.onchainConfirmationTimeStamp || 0,
        );
        lastRootSaved.root_hash = lastRootSaved.rootHash;
      }
    }

    let currentGeneration = _.get(rootHistory, '[0]');

    if (!lastRootSaved) {
      logger.info(
        `Syncing new registry ${organization.name} (store ${organization.orgUid})`,
      );

      logger.debug(`creating 'CREATE REGISTRY' audit entry`);
      await Audit.create({
        orgUid: organization.orgUid,
        registryId: organization.registryId,
        rootHash: currentGeneration.root_hash,
        type: 'CREATE REGISTRY',
        generation: 0,
        change: null,
        table: null,
        onchainConfirmationTimeStamp: currentGeneration.timestamp.toString(),
      });

      // Destroy existing records for this singleton
      // On a fresh db this does nothing, but when the audit table
      // is reset this will ensure that this organizations registry data is
      // cleaned up on both the local db and mirror db and ready to resync
      await Promise.all(
        Object.keys(ModelKeys).map(async (modelKey) => {
          logger.debug(
            `peforming destroy operation on home organization data in model ${modelKey}`,
          );
          ModelKeys[modelKey].destroy({
            where: {
              orgUid: organization.orgUid,
            },
          });
        }),
      );

      return;
    } else {
      currentGeneration = lastRootSaved;
    }

    const lastProcessedIndex = currentGeneration.generation;
    logger.debug(
      `1 Last processed index of ${organization.name}: ${lastProcessedIndex}`,
    );

    if (lastProcessedIndex > rootHistory.length) {
      logger.error(
        `Could not find root history for ${organization.name} (store ${organization.orgUid}) with timestamp ${currentGeneration.timestamp}, something is wrong and the sync for this organization will be paused until this is resolved.`,
      );
    }

    const rootHistoryZeroBasedCount = rootHistory.length - 1;
    const syncRemaining = rootHistoryZeroBasedCount - lastProcessedIndex;
    const isSynced = syncRemaining === 0;
    logger.debug(`2 the root history length for ${organization.name} is ${rootHistory.length} 
    and the last processed generation is ${lastProcessedIndex}`);
    logger.debug(`2 the highest root history index is ${rootHistoryZeroBasedCount}, 
    given this and the last processed index, the number of generations left to sync is ${syncRemaining}`);

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
        `3 Last processed index of ${organization.name}: ${lastProcessedIndex}`,
      );
      return;
    }

    const toBeProcessedIndex = lastProcessedIndex + 1;
    logger.debug(
      `3 Last processed index of ${organization.name}: ${lastProcessedIndex}`,
    );
    logger.debug(
      `4 To be processed index of ${organization.name}: ${toBeProcessedIndex}`,
    );

    // Organization not synced, sync it
    logger.info(' ');
    logger.info(
      `Syncing ${organization.name} generation ${toBeProcessedIndex} (store ${organization.orgUid})`,
    );
    logger.info(
      `${organization.name} is ${syncRemaining} DataLayer generations away from being fully synced (store ${organization.orgUid}).`,
    );

    if (!CONFIG.USE_SIMULATOR) {
      await new Promise((resolve) => setTimeout(resolve, 30000));

      logger.debug(`querying datalayer for ${organization.name} sync status`);
      const { sync_status } = await datalayer.getSyncStatus(
        organization.registryId,
      );

      if (toBeProcessedIndex > sync_status.generation) {
        const warningMsg = [
          `No data found for ${organization.name} (store ${organization.orgUid}) in the current datalayer generation.`,
          `DataLayer not yet caught up to generation ${lastProcessedIndex}. The current processed generation is ${sync_status.generation}.`,
          `This issue is often temporary and could be due to a lag in data propagation.`,
          'Syncing for this organization will be paused until this is resolved.',
          'For ongoing issues, please contact the organization.',
        ].join(' ');

        logger.warn(warningMsg);
        return;
      }
    }

    logger.debug(
      `5 Last processed index of ${organization.name}: ${lastProcessedIndex}`,
    );
    const lastProcessedRoot = _.get(rootHistory, `[${lastProcessedIndex}]`);
    logger.debug(
      `6 To be processed index of ${organization.name}: ${toBeProcessedIndex}`,
    );
    const rootToBeProcessed = _.get(rootHistory, `[${toBeProcessedIndex}]`);

    logger.debug(
      `last processed root of ${organization.name}: ${JSON.stringify(lastProcessedRoot)}`,
    );
    logger.debug(
      `root to be processed of ${organization.name}: ${JSON.stringify(rootToBeProcessed)}`,
    );

    if (!_.get(rootToBeProcessed, 'confirmed')) {
      logger.info(
        `Waiting for the latest root for ${organization.name} to confirm (store ${organization.orgUid})`,
      );
      return;
    }

    logger.debug(
      `7 Last processed index of ${organization.name}: ${lastProcessedIndex}`,
    );
    logger.debug(
      `8 To be processed index of ${organization.name}: ${toBeProcessedIndex}`,
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

    const updateTransaction = async (transaction, mirrorTransaction) => {
      logger.info(
        `Syncing ${organization.name} generation ${toBeProcessedIndex} (store ${organization.orgUid})`,
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
          generation: toBeProcessedIndex,
          comment: '',
          author: '',
        };

        logger.debug(`optimized kv diff is empty between ${organization.name} generations ${lastProcessedIndex}
         and ${toBeProcessedIndex}\n(roots [generation ${lastProcessedIndex}] ${lastProcessedRoot} 
         and [generation ${toBeProcessedIndex}] ${rootToBeProcessed})`);
        logger.debug(`creating audit entry`);
        await Audit.create(auditData, { transaction, mirrorTransaction });
      } else {
        logger.debug(`processing optimized kv diff for ${organization.name} generations ${lastProcessedIndex}
         and ${toBeProcessedIndex}\n(roots [generation ${lastProcessedIndex}] ${lastProcessedRoot} 
         and [generation ${toBeProcessedIndex}] ${rootToBeProcessed})`);

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
            generation: toBeProcessedIndex,
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
              logger.info(`UPSERTING: ${modelKey} - ${primaryKeyValue}`);

              // Remove updatedAt fields if they exist
              // This is because the db will update this field automatically and its not allowed to be null
              delete record.updatedAt;

              // if createdAt is null, remove it, so that the db will update it automatically
              // this field is also not allowed to be null
              if (_.isNil(record.createdAt)) {
                delete record.createdAt;
              }

              logger.debug(
                `upserting diff record and transaction to ${modelKey} model`,
              );
              await ModelKeys[modelKey].upsert(record, {
                transaction,
                mirrorTransaction,
              });
            } else if (diff.type === 'DELETE') {
              logger.info(`DELETING: ${modelKey} - ${primaryKeyValue}`);
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
          logger.debug(
            `creating audit model entry for ${organization.name} transacton`,
          );
          await Audit.create(auditData, { transaction, mirrorTransaction });
          await Organization.update(
            { registryHash: rootToBeProcessed.root_hash },
            {
              where: { orgUid: organization.orgUid },
              transaction,
              mirrorTransaction,
            },
          );
        }
      }
    };

    if (organization.orgUid === homeOrg?.orgUid) {
      afterCommitCallbacks.push(truncateStaging);
    }

    await createTransaction(updateTransaction, afterCommitCallbacks);
  } catch (error) {
    logger.error('Error syncing org audit', error);
  }
};

export default job;
