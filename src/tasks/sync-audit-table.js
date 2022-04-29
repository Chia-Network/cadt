import _ from 'lodash';

import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Organization, Audit } from '../models';
import datalayer from '../datalayer';
import { decodeHex } from '../utils/datalayer-utils';
import dotenv from 'dotenv';
import { logger } from '../config/logger.cjs';

import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';

logger.info('climate-warehouse:task:audit');

dotenv.config();
import { getConfig } from '../utils/config-loader';

const { USE_SIMULATOR } = getConfig().APP;

const task = new Task('sync-audit', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    logger.info('Syncing Audit Information');
    if (!USE_SIMULATOR) {
      const organizations = await Organization.findAll({
        where: { subscribed: true },
        raw: true,
      });
      await Promise.all(
        organizations.map((organization) =>
          syncOrganizationAudit(organization),
        ),
      );
    }
  } catch (error) {
    logger.error(`Retrying in 30 seconds`, error);
  }
});

const job = new SimpleIntervalJob(
  { seconds: 30, runImmediately: true },
  task,
  'sync-audit',
);

const syncOrganizationAudit = async (organization) => {
  try {
    logger.info('Syncing Audit:', organization);
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
      Audit.create({
        orgUid: organization.orgUid,
        registryId: organization.registryId,
        rootHash: _.get(rootHistory, '[0].root_hash'),
        type: 'CREATE REGISTRY',
        change: null,
        table: null,
        onchainConfirmationTimeStamp: _.get(rootHistory, '[0].timestamp'),
      });

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

    await Promise.all(
      kvDiff.map(async (diff) => {
        const key = decodeHex(diff.key);
        const modelKey = key.split('|')[0];
        Audit.create({
          orgUid: organization.orgUid,
          registryId: organization.registryId,
          rootHash: root2.root_hash,
          type: diff.type,
          table: modelKey,
          change: decodeHex(diff.value),
          onchainConfirmationTimeStamp: root2.timestamp,
        });
      }),
    );
  } catch (error) {
    logger.error('Error syncing org audit', error);
  }
};

export default job;
