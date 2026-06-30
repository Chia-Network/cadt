import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Meta, Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader';
import { getMirrorUrl, encodeHex, decodeHex } from '../utils/datalayer-utils';
import datalayer from '../datalayer';
import { getSubscriptions } from '../datalayer/persistance';
import dotenv from 'dotenv';

const APP_CONFIG = getConfig().APP;
dotenv.config({ quiet: true });

let mirrorCheckInProgress = false;

const task = new Task('mirror-check', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    const shouldMirror = APP_CONFIG?.AUTO_MIRROR_EXTERNAL_STORES ?? true;

    if (!APP_CONFIG.USE_SIMULATOR && shouldMirror) {
      await runMirrorCheck();
    }
  } catch (error) {
    logger.error(
      `[v1]: Mirror check failed. Retrying in ${APP_CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 900} seconds`,
      error,
    );
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: APP_CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 900,
    runImmediately: true,
  },
  task,
  { id: 'mirror-check', preventOverrun: true },
);

const runMirrorCheckInner = async () => {
  const mirrorUrl = await getMirrorUrl();

  if (!mirrorUrl) {
    logger.info(
      '[v1]: DATALAYER_FILE_SERVER_URL not set, skipping mirror announcements',
    );
    return;
  }

  // Mirror governance stores
  const governanceOrgUidResult = await Meta.findOne({
    where: { metaKey: 'governanceBodyId' },
    attributes: ['metaValue'],
    raw: true,
  });
  const governanceRegistryIdResult = await Meta.findOne({
    where: { metaKey: 'mainGoveranceBodyId' },
    attributes: ['metaValue'],
    raw: true,
  });

  if (
    governanceOrgUidResult?.metaValue &&
    governanceRegistryIdResult?.metaValue
  ) {
    await Organization.addMirror(
      governanceOrgUidResult?.metaValue,
      mirrorUrl,
      true,
    );
    await Organization.addMirror(
      governanceRegistryIdResult?.metaValue,
      mirrorUrl,
      true,
    );
  } else {
    const configGovernanceBodyId =
      getConfig().GOVERNANCE?.GOVERNANCE_BODY_ID;

    if (configGovernanceBodyId) {
      try {
        await Organization.addMirror(configGovernanceBodyId, mirrorUrl, true);
      } catch (error) {
        logger.error(
          `[v1]: Failed to mirror governance body ${configGovernanceBodyId}: ${error.message}`,
        );
      }

      try {
        const versionStoreIdHex = await datalayer.getValue(
          configGovernanceBodyId,
          encodeHex('v1'),
        );
        if (versionStoreIdHex) {
          const versionStoreId = decodeHex(versionStoreIdHex);
          if (versionStoreId) {
            await Organization.addMirror(versionStoreId, mirrorUrl, true);
          }
        }
      } catch (error) {
        logger.error(
          `[v1]: Failed to resolve/mirror governance version store: ${error.message}`,
        );
      }
    }
  }

  // Fetch DataLayer subscriptions to avoid mirroring unsubscribed stores.
  // Owned stores appear in this list too, so it covers both home and external orgs.
  const { storeIds: subscribedStoreIds, success: subsSuccess } =
    await getSubscriptions();
  const subscribedSet = subsSuccess ? new Set(subscribedStoreIds) : null;

  if (!subsSuccess) {
    logger.warn(
      '[v1]: Could not fetch DataLayer subscriptions; will attempt mirrors for all stores',
    );
  }

  const organizations = await Organization.getOrgsMap();
  const orgs = Object.keys(organizations);
  logger.info(`[v1]: Mirror check processing ${orgs.length} organizations`);

  for (const org of orgs) {
    const orgData = organizations[org];

    if (!orgData.subscribed) {
      continue;
    }

    const storesToMirror = [
      { label: 'orgUid', id: orgData.orgUid },
      { label: 'dataModelVersionStoreId', id: orgData.dataModelVersionStoreId },
      { label: 'registryId', id: orgData.registryId },
      { label: 'fileStoreId', id: orgData.fileStoreId },
    ];

    for (const { label, id } of storesToMirror) {
      if (!id) {
        continue;
      }

      if (subscribedSet && !subscribedSet.has(id)) {
        logger.debug(
          `[v1]: Skipping mirror for ${label} ${id} (${orgData.name}) - not subscribed in DataLayer`,
        );
        continue;
      }

      try {
        await Organization.addMirror(id, mirrorUrl, true);
      } catch (error) {
        logger.error(
          `[v1]: Failed to ensure mirror for ${label} ${id} (${orgData.name}): ${error.message}`,
        );
      }
    }
  }

  logger.info('[v1]: Mirror check complete');
};

const runMirrorCheck = async () => {
  if (mirrorCheckInProgress) {
    logger.info('[v1]: Mirror check already in progress, skipping concurrent run');
    return;
  }
  mirrorCheckInProgress = true;
  try {
    await runMirrorCheckInner();
  } finally {
    mirrorCheckInProgress = false;
  }
};

/**
 * Mirror only the stores belonging to a specific organization.
 * Used by org creation finalization to avoid running a full mirror check
 * across all orgs, which is slow and can conflict with the periodic task.
 * @param {Object} storeIds - Map of store labels to store IDs
 * @param {string} storeIds.orgUid
 * @param {string} [storeIds.registryId]
 * @param {string} [storeIds.dataModelVersionStoreId]
 * @param {string} [storeIds.fileStoreId]
 */
const mirrorOrgStores = async (storeIds) => {
  const mirrorUrl = await getMirrorUrl();
  if (!mirrorUrl) {
    return;
  }

  const entries = Object.entries(storeIds).filter(([, id]) => id);
  for (const [label, id] of entries) {
    try {
      await Organization.addMirror(id, mirrorUrl, true);
    } catch (error) {
      logger.warn(
        `[v1]: Failed to mirror ${label} ${id} (will be retried by periodic task): ${error.message}`,
      );
    }
  }
};

export default job;
export { runMirrorCheck, mirrorOrgStores };
