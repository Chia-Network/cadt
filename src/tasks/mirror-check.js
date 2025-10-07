import { SimpleIntervalJob, Task } from 'toad-scheduler';
import { Meta, Organization } from '../models';
import {
  assertDataLayerAvailable,
  assertWalletIsSynced,
} from '../utils/data-assertions';
import { logger } from '../config/logger.js';
import { getConfig } from '../utils/config-loader';
import { getMirrorUrl } from '../utils/datalayer-utils';
import dotenv from 'dotenv';

const APP_CONFIG = getConfig().APP;
dotenv.config();

// This task checks if there are any mirrors that have not been properly mirrored and then mirrors them if not

const task = new Task('mirror-check', async () => {
  logger.debug('[MIRROR_DEBUG] Mirror-check task started');

  try {
    logger.debug('[MIRROR_DEBUG] Checking data layer availability');
    await assertDataLayerAvailable();
    logger.debug('[MIRROR_DEBUG] Data layer is available');

    logger.debug('[MIRROR_DEBUG] Checking wallet sync status');
    await assertWalletIsSynced();
    logger.debug('[MIRROR_DEBUG] Wallet is synced');

    // Default AUTO_MIRROR_EXTERNAL_STORES to true if it is null or undefined
    const shouldMirror = APP_CONFIG?.AUTO_MIRROR_EXTERNAL_STORES ?? true;
    logger.debug(
      `[MIRROR_DEBUG] AUTO_MIRROR_EXTERNAL_STORES: ${shouldMirror}, USE_SIMULATOR: ${APP_CONFIG.USE_SIMULATOR}`,
    );

    if (!APP_CONFIG.USE_SIMULATOR && shouldMirror) {
      logger.debug('[MIRROR_DEBUG] Conditions met, running mirror check');
      await runMirrorCheck();
    } else {
      logger.debug('[MIRROR_DEBUG] Skipping mirror check - conditions not met');
    }
  } catch (error) {
    logger.error(
      `Retrying in ${APP_CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 300} seconds`,
      error,
    );
    logger.debug(`[MIRROR_DEBUG] Mirror-check task error: ${error.message}`);
  }
});

const job = new SimpleIntervalJob(
  {
    seconds: APP_CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 300,
    runImmediately: true,
  },
  task,
  { id: 'mirror-check', preventOverrun: true },
);

const runMirrorCheck = async () => {
  logger.debug('[MIRROR_DEBUG] Starting runMirrorCheck function');

  const mirrorUrl = await getMirrorUrl();
  logger.debug(`[MIRROR_DEBUG] Retrieved mirror URL: ${mirrorUrl}`);

  if (!mirrorUrl) {
    logger.info(
      'DATALAYER_FILE_SERVER_URL not set, skipping mirror announcements',
    );
    logger.debug('[MIRROR_DEBUG] Exiting runMirrorCheck - no mirror URL');
    return;
  }

  // get governance info if governance node
  logger.debug('[MIRROR_DEBUG] Checking for governance organization info');
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

  logger.debug(
    `[MIRROR_DEBUG] Governance org UID result: ${governanceOrgUidResult?.metaValue || 'null'}`,
  );
  logger.debug(
    `[MIRROR_DEBUG] Governance registry ID result: ${governanceRegistryIdResult?.metaValue || 'null'}`,
  );

  if (
    governanceOrgUidResult?.metaValue &&
    governanceRegistryIdResult?.metaValue
  ) {
    logger.debug('[MIRROR_DEBUG] Adding governance mirrors');
    // add governance mirrors if instance is governance
    // There is logic within the addMirror function to check if the mirror already exists
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
    logger.debug('[MIRROR_DEBUG] Completed governance mirror additions');
  } else {
    logger.debug(
      '[MIRROR_DEBUG] Skipping governance mirrors - missing governance data',
    );
  }

  logger.debug('[MIRROR_DEBUG] Retrieving organizations map');
  const organizations = await Organization.getOrgsMap();
  logger.debug(
    `[MIRROR_DEBUG] Retrieved ${Object.keys(organizations).length} organizations from getOrgsMap()`,
  );
  logger.debug(
    `[MIRROR_DEBUG] Organizations: ${JSON.stringify(Object.keys(organizations))}`,
  );

  const orgs = Object.keys(organizations);
  logger.debug(`[MIRROR_DEBUG] Processing ${orgs.length} organizations`);

  for (const org of orgs) {
    logger.debug(`[MIRROR_DEBUG] Processing organization: ${org}`);
    const orgData = organizations[org];
    logger.debug(
      `[MIRROR_DEBUG] Organization data: ${JSON.stringify({
        name: orgData.name,
        subscribed: orgData.subscribed,
        orgUid: orgData.orgUid,
        dataModelVersionStoreId: orgData.dataModelVersionStoreId,
        registryId: orgData.registryId,
      })}`,
    );

    if (orgData.subscribed) {
      logger.debug(
        `[MIRROR_DEBUG] Organization ${org} is subscribed, adding mirrors`,
      );
      try {
        await Organization.addMirror(orgData.orgUid, mirrorUrl, true);
        logger.debug(
          `[MIRROR_DEBUG] Added mirror for orgUid: ${orgData.orgUid}`,
        );
      } catch (error) {
        logger.error(
          `[MIRROR_DEBUG] Failed to add mirror for orgUid ${orgData.orgUid}: ${error.message}`,
        );
      }

      if (orgData.dataModelVersionStoreId) {
        try {
          await Organization.addMirror(
            orgData.dataModelVersionStoreId,
            mirrorUrl,
            true,
          );
          logger.debug(
            `[MIRROR_DEBUG] Added mirror for dataModelVersionStoreId: ${orgData.dataModelVersionStoreId}`,
          );
        } catch (error) {
          logger.error(
            `[MIRROR_DEBUG] Failed to add mirror for dataModelVersionStoreId ${orgData.dataModelVersionStoreId}: ${error.message}`,
          );
        }
      } else {
        logger.debug(
          `[MIRROR_DEBUG] Skipping dataModelVersionStoreId mirror - value is null/undefined`,
        );
      }

      if (orgData.registryId) {
        try {
          await Organization.addMirror(orgData.registryId, mirrorUrl, true);
          logger.debug(
            `[MIRROR_DEBUG] Added mirror for registryId: ${orgData.registryId}`,
          );
        } catch (error) {
          logger.error(
            `[MIRROR_DEBUG] Failed to add mirror for registryId ${orgData.registryId}: ${error.message}`,
          );
        }
      } else {
        logger.debug(
          `[MIRROR_DEBUG] Skipping registryId mirror - value is null/undefined`,
        );
      }
    } else {
      logger.debug(
        `[MIRROR_DEBUG] Organization ${org} is not subscribed, skipping`,
      );
    }
  }

  logger.debug('[MIRROR_DEBUG] Completed runMirrorCheck function');
};

export default job;
