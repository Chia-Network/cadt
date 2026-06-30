import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { MetaV2, OrganizationsV2 } from '../models/v2/index.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { loggerV2 } from '../config/logger.js';
import { getConfig, getConfigV2 } from '../utils/config-loader.js';
import {
  getMirrorUrl,
  encodeHex,
  decodeHex,
} from '../utils/datalayer-utils.js';
import datalayer from '../datalayer/index.js';
import { getSubscriptions } from '../datalayer/persistance.js';
import dotenv from 'dotenv';

const APP_CONFIG = getConfig().APP;
dotenv.config({ quiet: true });

let mirrorCheckInProgress = false;

const task = new Task('mirror-check-v2', async () => {
  try {
    await assertDataLayerAvailable();
    await assertWalletIsSynced();

    const shouldMirror = APP_CONFIG?.AUTO_MIRROR_EXTERNAL_STORES ?? true;

    if (!APP_CONFIG.USE_SIMULATOR && shouldMirror) {
      await runMirrorCheckV2();
    }
  } catch (error) {
    loggerV2.error(
      `[v2]: Mirror check failed. Retrying in ${APP_CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 900} seconds`,
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
  { id: 'mirror-check-v2', preventOverrun: true },
);

const runMirrorCheckV2Inner = async () => {
  const mirrorUrl = await getMirrorUrl();

  if (!mirrorUrl) {
    loggerV2.info(
      '[v2]: DATALAYER_FILE_SERVER_URL not set, skipping mirror announcements',
    );
    return;
  }

  // Mirror governance stores
  const governanceOrgUidResult = await MetaV2.findOne({
    where: { meta_key: 'governanceBodyId' },
    attributes: ['meta_value'],
    raw: true,
  });
  const governanceRegistryIdResult = await MetaV2.findOne({
    where: { meta_key: 'mainGoveranceBodyId' },
    attributes: ['meta_value'],
    raw: true,
  });

  if (
    governanceOrgUidResult?.meta_value &&
    governanceRegistryIdResult?.meta_value
  ) {
    await OrganizationsV2.addMirror(
      governanceOrgUidResult?.meta_value,
      mirrorUrl,
      true,
    );
    await OrganizationsV2.addMirror(
      governanceRegistryIdResult?.meta_value,
      mirrorUrl,
      true,
    );
  } else {
    const configGovernanceBodyId =
      getConfigV2().GOVERNANCE?.GOVERNANCE_BODY_ID;

    if (configGovernanceBodyId) {
      try {
        await OrganizationsV2.addMirror(
          configGovernanceBodyId,
          mirrorUrl,
          true,
        );
      } catch (error) {
        loggerV2.error(
          `[v2]: Failed to mirror governance body ${configGovernanceBodyId}: ${error.message}`,
        );
      }

      try {
        const versionStoreIdHex = await datalayer.getValue(
          configGovernanceBodyId,
          encodeHex('v2'),
        );
        if (versionStoreIdHex) {
          const versionStoreId = decodeHex(versionStoreIdHex);
          if (versionStoreId) {
            await OrganizationsV2.addMirror(versionStoreId, mirrorUrl, true);
          }
        }
      } catch (error) {
        loggerV2.error(
          `[v2]: Failed to resolve/mirror governance version store: ${error.message}`,
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
    loggerV2.warn(
      '[v2]: Could not fetch DataLayer subscriptions; will attempt mirrors for all stores',
    );
  }

  const organizations = await OrganizationsV2.getOrgsMap();
  const orgs = Object.keys(organizations);
  loggerV2.info(`[v2]: Mirror check processing ${orgs.length} organizations`);

  for (const org of orgs) {
    const orgData = organizations[org];

    if (!orgData.subscribed) {
      continue;
    }

    const storesToMirror = [
      { label: 'org_uid', id: orgData.org_uid },
      { label: 'data_model_version_store_id', id: orgData.data_model_version_store_id },
      { label: 'registry_id', id: orgData.registry_id },
      { label: 'file_store', id: orgData.file_store_subscribed },
    ];

    for (const { label, id } of storesToMirror) {
      if (!id) {
        continue;
      }

      if (subscribedSet && !subscribedSet.has(id)) {
        loggerV2.debug(
          `[v2]: Skipping mirror for ${label} ${id} (${orgData.name}) - not subscribed in DataLayer`,
        );
        continue;
      }

      try {
        await OrganizationsV2.addMirror(id, mirrorUrl, true);
      } catch (error) {
        loggerV2.error(
          `[v2]: Failed to ensure mirror for ${label} ${id} (${orgData.name}): ${error.message}`,
        );
      }
    }
  }

  loggerV2.info('[v2]: Mirror check complete');
};

const runMirrorCheckV2 = async () => {
  if (mirrorCheckInProgress) {
    loggerV2.info('[v2]: Mirror check already in progress, skipping concurrent run');
    return;
  }
  mirrorCheckInProgress = true;
  try {
    await runMirrorCheckV2Inner();
  } finally {
    mirrorCheckInProgress = false;
  }
};

/**
 * Mirror only the stores belonging to a specific organization.
 * Used by org creation / upgrade finalization to avoid running a full mirror
 * check across all orgs, which is slow and can conflict with the periodic task.
 * @param {Object} storeIds - Map of store labels to store IDs
 * @param {string} storeIds.orgUid
 * @param {string} [storeIds.registryId]
 * @param {string} [storeIds.dataModelVersionStoreId]
 * @param {string} [storeIds.fileStoreId]
 */
const mirrorOrgStoresV2 = async (storeIds) => {
  const mirrorUrl = await getMirrorUrl();
  if (!mirrorUrl) {
    return;
  }

  const entries = Object.entries(storeIds).filter(([, id]) => id);
  for (const [label, id] of entries) {
    try {
      await OrganizationsV2.addMirror(id, mirrorUrl, true);
    } catch (error) {
      loggerV2.warn(
        `[v2]: Failed to mirror ${label} ${id} (will be retried by periodic task): ${error.message}`,
      );
    }
  }
};

export default job;
export { runMirrorCheckV2, mirrorOrgStoresV2 };

