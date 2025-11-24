import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { MetaV2, OrganizationsV2 } from '../models/v2/index.js';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions.js';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader.js';
import { getMirrorUrl } from '../utils/datalayer-utils.js';
import dotenv from 'dotenv';

const APP_CONFIG = getConfig().APP;
dotenv.config();

// This task checks if there are any mirrors that have not been properly mirrored and then mirrors them if not

const task = new Task('mirror-check-v2', async () => {
  logger.silly('[MIRROR_DEBUG] Mirror-check V2 task started');

  try {
    logger.silly('[MIRROR_DEBUG] Checking data layer availability');
    await assertDataLayerAvailable();
    logger.silly('[MIRROR_DEBUG] Data layer is available');

    logger.silly('[MIRROR_DEBUG] Checking wallet sync status');
    await assertWalletIsSynced();
    logger.silly('[MIRROR_DEBUG] Wallet is synced');

    // Default AUTO_MIRROR_EXTERNAL_STORES to true if it is null or undefined
    const shouldMirror = APP_CONFIG?.AUTO_MIRROR_EXTERNAL_STORES ?? true;
    logger.debug(
      `[MIRROR_DEBUG] AUTO_MIRROR_EXTERNAL_STORES: ${shouldMirror}, USE_SIMULATOR: ${APP_CONFIG.USE_SIMULATOR}`,
    );

    if (!APP_CONFIG.USE_SIMULATOR && shouldMirror) {
      logger.silly('[MIRROR_DEBUG] Conditions met, running mirror check');
      await runMirrorCheckV2();
    } else {
      logger.silly('[MIRROR_DEBUG] Skipping mirror check - conditions not met');
    }
  } catch (error) {
    logger.error(
      `Retrying in ${APP_CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 300} seconds`,
      error,
    );
    logger.silly(`[MIRROR_DEBUG] Mirror-check V2 task error: ${error.message}`);
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: APP_CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  { id: 'mirror-check-v2', preventOverrun: true },
);

const runMirrorCheckV2 = async () => {
  logger.silly('[MIRROR_DEBUG] Starting runMirrorCheckV2 function');

  const mirrorUrl = await getMirrorUrl();
  logger.silly(`[MIRROR_DEBUG] Retrieved mirror URL: ${mirrorUrl}`);

  if (!mirrorUrl) {
    logger.info(
      'DATALAYER_FILE_SERVER_URL not set, skipping mirror announcements',
    );
    logger.silly('[MIRROR_DEBUG] Exiting runMirrorCheckV2 - no mirror URL');
    return;
  }

  // get governance info if governance node
  logger.silly('[MIRROR_DEBUG] Checking for V2 governance organization info');
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

  logger.debug(
    `[MIRROR_DEBUG] Governance org UID result: ${governanceOrgUidResult?.meta_value || 'null'}`,
  );
  logger.debug(
    `[MIRROR_DEBUG] Governance registry ID result: ${governanceRegistryIdResult?.meta_value || 'null'}`,
  );

  if (
    governanceOrgUidResult?.meta_value &&
    governanceRegistryIdResult?.meta_value
  ) {
    logger.silly('[MIRROR_DEBUG] Adding governance mirrors');
    // add governance mirrors if instance is governance
    // There is logic within the addMirror function to check if the mirror already exists
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
    logger.silly('[MIRROR_DEBUG] Completed governance mirror additions');
  } else {
    logger.debug(
      '[MIRROR_DEBUG] Skipping governance mirrors - missing governance data',
    );
  }

  logger.silly('[MIRROR_DEBUG] Retrieving V2 organizations map');
  const organizations = await OrganizationsV2.getOrgsMap();
  logger.debug(
    `[MIRROR_DEBUG] Retrieved ${Object.keys(organizations).length} organizations from getOrgsMap()`,
  );
  logger.debug(
    `[MIRROR_DEBUG] Organizations: ${JSON.stringify(Object.keys(organizations))}`,
  );

  const orgs = Object.keys(organizations);
  logger.silly(`[MIRROR_DEBUG] Processing ${orgs.length} organizations`);

  for (const org of orgs) {
    logger.silly(`[MIRROR_DEBUG] Processing organization: ${org}`);
    const orgData = organizations[org];
    logger.debug(
      `[MIRROR_DEBUG] Organization data: ${JSON.stringify({
        name: orgData.name,
        subscribed: orgData.subscribed,
        org_uid: orgData.org_uid,
        data_model_version_store_id: orgData.data_model_version_store_id,
        registry_id: orgData.registry_id,
      })}`,
    );

    if (orgData.subscribed) {
      logger.debug(
        `[MIRROR_DEBUG] Organization ${org} is subscribed, adding mirrors`,
      );
      try {
        await OrganizationsV2.addMirror(orgData.org_uid, mirrorUrl, true);
        logger.debug(
          `[MIRROR_DEBUG] Added mirror for org_uid: ${orgData.org_uid}`,
        );
      } catch (error) {
        logger.error(
          `[MIRROR_DEBUG] Failed to add mirror for org_uid ${orgData.org_uid}: ${error.message}`,
        );
      }

      if (orgData.data_model_version_store_id) {
        try {
          await OrganizationsV2.addMirror(
            orgData.data_model_version_store_id,
            mirrorUrl,
            true,
          );
          logger.debug(
            `[MIRROR_DEBUG] Added mirror for data_model_version_store_id: ${orgData.data_model_version_store_id}`,
          );
        } catch (error) {
          logger.error(
            `[MIRROR_DEBUG] Failed to add mirror for data_model_version_store_id ${orgData.data_model_version_store_id}: ${error.message}`,
          );
        }
      } else {
        logger.debug(
          `[MIRROR_DEBUG] Skipping data_model_version_store_id mirror - value is null/undefined`,
        );
      }

      if (orgData.registry_id) {
        try {
          await OrganizationsV2.addMirror(orgData.registry_id, mirrorUrl, true);
          logger.debug(
            `[MIRROR_DEBUG] Added mirror for registry_id: ${orgData.registry_id}`,
          );
        } catch (error) {
          logger.error(
            `[MIRROR_DEBUG] Failed to add mirror for registry_id ${orgData.registry_id}: ${error.message}`,
          );
        }
      } else {
        logger.debug(
          `[MIRROR_DEBUG] Skipping registry_id mirror - value is null/undefined`,
        );
      }
    } else {
      logger.debug(
        `[MIRROR_DEBUG] Organization ${org} is not subscribed, skipping`,
      );
    }
  }

  logger.silly('[MIRROR_DEBUG] Completed runMirrorCheckV2 function');
};

export default job;

