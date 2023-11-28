import _ from 'lodash';

import { Sequelize } from 'sequelize';
import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Mutex } from 'async-mutex';
import { Organization, Audit, ModelKeys, Staging, Meta } from '../models';
import datalayer from '../datalayer';
import { decodeHex, encodeHex } from '../utils/datalayer-utils';
import dotenv from 'dotenv';
import { logger } from '../logger.js';
import { sequelize, sequelizeMirror } from '../database';
import { CONFIG } from '../user-config';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { mirrorDBEnabled } from '../database';

dotenv.config();
const mutex = new Mutex();

const task = new Task('sync-datalayer', async () => {
  if (!mutex.isLocked()) {
    const releaseMutex = await mutex.acquire();
    try {
      const hasMigratedToNewSyncMethod = await Meta.findOne({
        where: { metaKey: 'migratedToNewSync' },
      });

      if (hasMigratedToNewSyncMethod || CONFIG().CADT.USE_SIMULATOR) {
        await processJob();
      } else {
        logger.info(
          'Initiating migration to the new synchronization method. This will require a complete resynchronization of all data and may take some time.',
        );

        for (const modelKey of Object.keys(ModelKeys)) {
          logger.info(`Resetting ${modelKey}`);
          await ModelKeys[modelKey].destroy({
            where: {
              id: {
                [Sequelize.Op.ne]: null,
              },
            },
            truncate: true,
          });
        }

        logger.info(`Resetting Audit Table`);
        await Audit.destroy({
          where: {
            id: {
              [Sequelize.Op.ne]: null,
            },
          },
          truncate: true,
        });

        await Meta.upsert({
          metaKey: 'migratedToNewSync',
          metaValue: 'true',
        });

        await Organization.update(
          {
            synced: false,
            sync_remaining: 0,
          },
          {
            where: {
              id: {
                [Sequelize.Op.ne]: null,
              },
            },
          },
        );

        logger.info(`Migration Complete`);
      }
    } catch (error) {
      logger.error(`Error during datasync: ${error.message}`);

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
  { id: 'sync-datalayer', preventOverrun: true },
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

/**
 * Optimizes and sorts an array of key-value differences.
 * NOTE: The only reason this function works is because we treat INSERTS as UPSERTS
 * If that ever changes, this function will need to be removed.
 *
 * @param {Array} kvDiff - An array of objects with { key, type } structure.
 * @returns {Array} - An optimized and sorted array.
 */
function optimizeAndSortKvDiff(kvDiff) {
  const deleteKeys = new Set();
  const insertKeys = new Set();

  // Populate the Sets for quicker lookup
  for (const diff of kvDiff) {
    if (diff.type === 'DELETE') {
      deleteKeys.add(diff.key);
    } else if (diff.type === 'INSERT') {
      insertKeys.add(diff.key);
    }
  }

  // Remove DELETE keys that also exist in INSERT keys
  for (const insertKey of insertKeys) {
    deleteKeys.delete(insertKey);
  }

  // Filter and sort the array based on the optimized DELETE keys
  const filteredArray = kvDiff.filter((diff) => {
    return diff.type !== 'DELETE' || deleteKeys.has(diff.key);
  });

  return filteredArray.sort((a, b) => {
    return a.type === b.type ? 0 : a.type === 'DELETE' ? -1 : 1;
  });
}

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

    logger.info('Committed transaction');

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

const syncOrganizationAudit = async (organization) => {
  try {
    let afterCommitCallbacks = [];

    const homeOrg = await Organization.getHomeOrg();
    const rootHistory = (
      await datalayer.getRootHistory(organization.registryId)
    ).sort((a, b) => a.timestamp - b.timestamp);

    if (!rootHistory.length) {
      logger.info(`No root history found for ${organization.name}`);
      return;
    }

    let lastRootSaved;

    if (CONFIG().CADT.USE_SIMULATOR) {
      console.log('USING MOCK ROOT HISTORY');
      lastRootSaved = rootHistory[0];
      lastRootSaved.rootHash = lastRootSaved.root_hash;
    } else {
      lastRootSaved = await Audit.findOne({
        where: { registryId: organization.registryId },
        order: [['onchainConfirmationTimeStamp', 'DESC']],
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

    let generation = _.get(rootHistory, '[0]');

    if (!lastRootSaved) {
      logger.info(`Syncing new registry ${organization.name}`);
      await Audit.create({
        orgUid: organization.orgUid,
        registryId: organization.registryId,
        rootHash: generation.root_hash,
        type: 'CREATE REGISTRY',
        change: null,
        table: null,
        onchainConfirmationTimeStamp: generation.timestamp,
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
      generation = lastRootSaved;
    }

    let isSynced =
      rootHistory[rootHistory.length - 1].root_hash === generation.root_hash;

    const historyIndex = rootHistory.findIndex(
      (root) => root.timestamp === generation.timestamp,
    );

    if (historyIndex === -1) {
      logger.error(
        `Could not find root history for ${organization.name} with timestamp ${generation.timestamp}, something is wrong and the sync for this organization will be paused until this is resolved.`,
      );
    }

    const syncRemaining = rootHistory.length - historyIndex - 1;

    await Organization.update(
      {
        synced: isSynced,
        sync_remaining: syncRemaining,
      },
      { where: { orgUid: organization.orgUid } },
    );

    if (process.env.NODE_ENV !== 'test' && isSynced) {
      return;
    }

    // Organization not synced, sync it
    logger.info(' ');
    logger.info(`Syncing Registry: ${_.get(organization, 'name')}`);
    logger.info(
      `${organization.name} is ${syncRemaining} DataLayer generations away from being fully synced.`,
    );

    if (!CONFIG().CADT.USE_SIMULATOR) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }

    const root1 = _.get(rootHistory, `[${historyIndex}]`);
    const root2 = _.get(rootHistory, `[${historyIndex + 1}]`);

    if (!_.get(root2, 'confirmed')) {
      logger.info(
        `Waiting for the latest root for ${organization.name} to confirm`,
      );
      return;
    }

    const kvDiff = await datalayer.getRootDiff(
      organization.registryId,
      root1.root_hash,
      root2.root_hash,
    );

    if (_.isEmpty(kvDiff)) {
      const warningMsg = [
        `No data found for ${organization.name} in the current datalayer generation.`,
        `Missing data for root hash: ${root2.root_hash}.`,
        `This issue is often temporary and could be due to a lag in data propagation.`,
        'Syncing for this organization will be paused until this is resolved.',
        'For ongoing issues, please contact the organization.',
      ].join(' ');

      logger.warn(warningMsg);
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

    const updateTransaction = async (transaction, mirrorTransaction) => {
      for (const diff of optimizedKvDiff) {
        const key = decodeHex(diff.key);
        const modelKey = key.split('|')[0];

        if (!['comment', 'author'].includes(key)) {
          const auditData = {
            orgUid: organization.orgUid,
            registryId: organization.registryId,
            rootHash: root2.root_hash,
            type: diff.type,
            table: modelKey,
            change: decodeHex(diff.value),
            onchainConfirmationTimeStamp: root2.timestamp,
            comment: _.get(
              JSON.parse(
                decodeHex(_.get(comment, '[0].value', encodeHex('{}'))),
              ),
              'comment',
              '',
            ),
            author: _.get(
              JSON.parse(
                decodeHex(_.get(author, '[0].value', encodeHex('{}'))),
              ),
              'author',
              '',
            ),
          };

          if (modelKey) {
            const record = JSON.parse(decodeHex(diff.value));
            const primaryKeyValue =
              record[ModelKeys[modelKey].primaryKeyAttributes[0]];

            if (diff.type === 'INSERT') {
              logger.info(`UPSERTING: ${modelKey} - ${primaryKeyValue}`);
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

            if (organization.orgUid === homeOrg?.orgUid) {
              const stagingUuid = [
                'unit',
                'project',
                'units',
                'projects',
              ].includes(modelKey)
                ? primaryKeyValue
                : undefined;

              if (stagingUuid) {
                afterCommitCallbacks.push(async () => {
                  logger.info(`DELETING STAGING: ${stagingUuid}`);
                  await Staging.destroy({
                    where: { uuid: stagingUuid },
                  });
                });
              }
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

    await createTransaction(updateTransaction, afterCommitCallbacks);
  } catch (error) {
    logger.error('Error syncing org audit', error);
  }
};

export default job;
