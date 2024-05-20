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
import { logger } from '../config/logger.cjs';
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
    logger.info('Starting transaction');
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

    logger.info('Commited transaction');

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
  } catch (error) {
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
  try {
    let afterCommitCallbacks = [];

    const homeOrg = await Organization.getHomeOrg();
    const rootHistory = await datalayer.getRootHistory(organization.registryId);

    if (!rootHistory.length) {
      logger.info(`No root history found for ${organization.name}`);
      return;
    }

    let lastRootSaved;

    if (CONFIG.USE_SIMULATOR) {
      console.log('USING MOCK ROOT HISTORY');
      lastRootSaved = rootHistory[0];
      lastRootSaved.rootHash = lastRootSaved.root_hash;
      lastRootSaved.generation = 0;
    } else {
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
      logger.info(`Syncing new registry ${organization.name}`);

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
    logger.debug(`1 Last processed index: ${lastProcessedIndex}`);

    if (lastProcessedIndex > rootHistory.length) {
      logger.error(
        `Could not find root history for ${organization.name} with timestamp ${currentGeneration.timestamp}, something is wrong and the sync for this organization will be paused until this is resolved.`,
      );
    }

    const rootHistoryZeroBasedCount = rootHistory.length - 1;
    const syncRemaining = rootHistoryZeroBasedCount - lastProcessedIndex;
    const isSynced = syncRemaining === 0;

    await Organization.update(
      {
        synced: isSynced,
        sync_remaining: syncRemaining,
      },
      { where: { orgUid: organization.orgUid } },
    );

    if (process.env.NODE_ENV !== 'test' && isSynced) {
      logger.debug(`3 Last processed index: ${lastProcessedIndex}`);
      return;
    }

    const toBeProcessedIndex = lastProcessedIndex + 1;
    logger.debug(`3 Last processed index: ${lastProcessedIndex}`);
    logger.debug(`4 To be processed index: ${toBeProcessedIndex}`);

    // Organization not synced, sync it
    logger.info(' ');
    logger.info(
      `Syncing ${organization.name} generation ${toBeProcessedIndex}`,
    );
    logger.info(
      `${organization.name} is ${syncRemaining} DataLayer generations away from being fully synced.`,
    );

    if (!CONFIG.USE_SIMULATOR) {
      await new Promise((resolve) => setTimeout(resolve, 30000));

      const { sync_status } = await datalayer.getSyncStatus(
        organization.registryId,
      );

      logger.debug(`4.5 sync_status.generation: ${sync_status.generation}`);
      if (toBeProcessedIndex > sync_status.generation) {
        const warningMsg = [
          `No data found for ${organization.name} in the current datalayer generation.`,
          `DataLayer not yet caught up to generation ${lastProcessedIndex}. The current processed generation is ${sync_status.generation}.`,
          `This issue is often temporary and could be due to a lag in data propagation.`,
          'Syncing for this organization will be paused until this is resolved.',
          'For ongoing issues, please contact the organization.',
        ].join(' ');

        logger.warn(warningMsg);
        return;
      }
    }

    logger.debug(`5 Last processed index: ${lastProcessedIndex}`);
    const root1 = _.get(rootHistory, `[${lastProcessedIndex}]`);
    logger.debug(`6 To be processed index: ${toBeProcessedIndex}`);
    const root2 = _.get(rootHistory, `[${toBeProcessedIndex}]`);

    logger.info(`ROOT 1 ${JSON.stringify(root1)}`);
    logger.info(`ROOT 2', ${JSON.stringify(root2)}`);

    if (!_.get(root2, 'confirmed')) {
      logger.info(
        `Waiting for the latest root for ${organization.name} to confirm`,
      );
      return;
    }

    logger.debug(`7 Last processed index: ${lastProcessedIndex}`);
    logger.debug(`8 To be processed index: ${toBeProcessedIndex}`);

    const kvDiff = await datalayer.getRootDiff(
      organization.registryId,
      root1.root_hash,
      root2.root_hash,
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
        `Syncing ${organization.name} generation ${toBeProcessedIndex}`,
      );
      if (_.isEmpty(optimizedKvDiff)) {
        const auditData = {
          orgUid: organization.orgUid,
          registryId: organization.registryId,
          rootHash: root2.root_hash,
          type: 'NO CHANGE',
          table: null,
          change: null,
          onchainConfirmationTimeStamp: root2.timestamp,
          generation: toBeProcessedIndex,
          comment: '',
          author: '',
        };

        await Audit.create(auditData, { transaction, mirrorTransaction });
      } else {
        for (const diff of optimizedKvDiff) {
          const key = decodeHex(diff.key);
          const modelKey = key.split('|')[0];

          const auditData = {
            orgUid: organization.orgUid,
            registryId: organization.registryId,
            rootHash: root2.root_hash,
            type: diff.type,
            table: modelKey,
            change: decodeHex(diff.value),
            onchainConfirmationTimeStamp: root2.timestamp,
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
          await Audit.create(auditData, { transaction, mirrorTransaction });
          await Organization.update(
            { registryHash: root2.root_hash },
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
