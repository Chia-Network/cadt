import _ from 'lodash';

import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization, Audit, ModelKeys } from '../models';
import datalayer from '../datalayer';
import { decodeHex } from '../utils/datalayer-utils';
import dotenv from 'dotenv';
import { logger } from '../logger.js';
import { sequelize } from '../database';

import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';

dotenv.config();
import { CONFIG } from '../user-config';

let taskIsRunning = false;

const task = new Task('sync-audit', async () => {
  try {
    if (!taskIsRunning) {
      taskIsRunning = true;
      await processJob();
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
    taskIsRunning = false;
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: CONFIG().CADT.TASKS?.AUDIT_SYNC_TASK_INTERVAL || 30,
    runImmediately: true,
  },
  task,
  'sync-audit',
);

const processJob = async () => {
  await assertDataLayerAvailable();
  await assertWalletIsSynced();

  logger.task('Syncing Audit Information');
  if (!CONFIG().CADT.USE_SIMULATOR) {
    const organizations = await Organization.findAll({
      where: { subscribed: true },
      raw: true,
    });

    for (const organization of organizations) {
      await syncOrganizationAudit(organization);
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          (CONFIG().CADT.TASKS?.AUDIT_SYNC_TASK_INTERVAL || 30) * 1000,
        ),
      );
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));
};

async function createTransaction(callback) {
  let result = null;

  let transaction;

  try {
    // Check if the database is locked and wait until it's unlocked
    /* while (await isDatabaseLocked()) {
      logger.debug('Database is locked. Waiting...');
      await waitFor(retryDelay);
    }*/

    logger.trace('Starting transaction');
    // Start a transaction
    transaction = await sequelize.transaction();

    // Execute the provided callback with the transaction
    result = await callback(transaction);

    // Commit the transaction if the callback completes without errors
    await transaction.commit();
    logger.trace('Commited transaction');

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
    logger.task(`Syncing Audit: ${_.get(organization, 'name')}`);
    const rootHistory = await datalayer.getRootHistory(organization.registryId);

    const lastRootSaved = await Audit.findOne({
      where: { registryId: organization.registryId },
      order: [['createdAt', 'DESC']],
      raw: true,
    });

    if (!rootHistory.length) {
      return;
    }

    let rootHash = _.get(rootHistory, '[0].root_hash');

    if (lastRootSaved) {
      rootHash = lastRootSaved.rootHash;
    }

    const historyIndex = rootHistory.findIndex(
      (root) => root.root_hash === rootHash,
    );

    if (!lastRootSaved) {
      await Audit.create({
        orgUid: organization.orgUid,
        registryId: organization.registryId,
        rootHash: _.get(rootHistory, '[0].root_hash'),
        type: 'CREATE REGISTRY',
        change: null,
        table: null,
        onchainConfirmationTimeStamp: _.get(rootHistory, '[0].timestamp'),
      });

      // Destroy existing records for this singleton
      // On a fresh db this does nothing, but when the audit table
      // is reset this will ensure that this organizations regsitry data is
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
    }

    if (historyIndex === rootHistory.length) {
      return;
    }

    const root1 = _.get(rootHistory, `[${historyIndex}]`);
    const root2 = _.get(rootHistory, `[${historyIndex + 1}]`);

    if (!_.get(root2, 'confirmed')) {
      return;
    }

    const kvDiff = await datalayer.getRootDiff(
      organization.registryId,
      root1.root_hash,
      root2.root_hash,
    );

    if (_.isEmpty(kvDiff)) {
      return;
    }

    // 0x636f6d6d656e74 is hex for 'comment'
    const comment = kvDiff.filter(
      (diff) =>
        (diff.key === '636f6d6d656e74' || diff.key === '0x636f6d6d656e74') &&
        diff.type === 'INSERT',
    );

    // 0x617574686F72 is hex for 'author'
    const author = kvDiff.filter(
      (diff) =>
        (diff.key === '617574686f72' || diff.key === '0x617574686F72') &&
        diff.type === 'INSERT',
    );

    // Process any deletes in the kv diff first to ensure correct processing order
    kvDiff.sort((a, b) => {
      const typeOrder = { DELETE: 0, INSERT: 1 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

    const updateTransaction = async (transaction) => {
      for (const diff of kvDiff) {
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
              JSON.parse(decodeHex(_.get(comment, '[0].value', '7b7d'))),
              'comment',
              '',
            ),
            author: _.get(
              JSON.parse(decodeHex(_.get(author, '[0].value', '7b7d'))),
              'author',
              '',
            ),
          };

          if (modelKey) {
            const record = JSON.parse(decodeHex(diff.value));

            if (diff.type === 'INSERT') {
              const primaryKeyValue =
                record[ModelKeys[modelKey].primaryKeyAttributes[0]];

              logger.trace(`INSERTING: ${modelKey} - ${primaryKeyValue}`);
              await ModelKeys[modelKey].upsert(record, { transaction });
            } else if (diff.type === 'DELETE') {
              logger.trace(
                `DELETING: ${modelKey} - ${
                  record[ModelKeys[modelKey].primaryKeyAttributes[0]]
                }`,
              );
              await ModelKeys[modelKey].destroy({
                where: {
                  [ModelKeys[modelKey].primaryKeyAttributes[0]]:
                    record[ModelKeys[modelKey].primaryKeyAttributes[0]],
                },
                transaction,
              });
            }
          }

          // Create the Audit record
          await Audit.create(auditData, { transaction });
          await Organization.update(
            { registryHash: root2.root_hash },
            { where: { orgUid: organization.orgUid }, transaction },
          );
        }
      }
    };

    return createTransaction(updateTransaction);
  } catch (error) {
    logger.error('Error syncing org audit', error);
  }
};

export default job;
