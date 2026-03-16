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
import dotenv from 'dotenv';

const APP_CONFIG = getConfig().APP;
dotenv.config({ quiet: true });

// This task checks if there are any mirrors that have not been properly mirrored and then mirrors them if not

const task = new Task('mirror-check', async () => {
  logger.silly('[v1]: [MIRROR_DEBUG] Mirror-check task started');

  try {
    logger.silly('[v1]: [MIRROR_DEBUG] Checking data layer availability');
    await assertDataLayerAvailable();
    logger.silly('[v1]: [MIRROR_DEBUG] Data layer is available');

    logger.silly('[v1]: [MIRROR_DEBUG] Checking wallet sync status');
    await assertWalletIsSynced();
    logger.silly('[v1]: [MIRROR_DEBUG] Wallet is synced');

    // Default AUTO_MIRROR_EXTERNAL_STORES to true if it is null or undefined
    const shouldMirror = APP_CONFIG?.AUTO_MIRROR_EXTERNAL_STORES ?? true;
    logger.debug(
      `[MIRROR_DEBUG] AUTO_MIRROR_EXTERNAL_STORES: ${shouldMirror}, USE_SIMULATOR: ${APP_CONFIG.USE_SIMULATOR}`,
    );

    if (!APP_CONFIG.USE_SIMULATOR && shouldMirror) {
      logger.silly('[v1]: [MIRROR_DEBUG] Conditions met, running mirror check');
      await runMirrorCheck();
    } else {
      logger.silly('[v1]: [MIRROR_DEBUG] Skipping mirror check - conditions not met');
    }
  } catch (error) {
    logger.error(
      `Retrying in ${APP_CONFIG?.TASKS?.MIRROR_CHECK_TASK_INTERVAL || 300} seconds`,
      error,
    );
    logger.silly(`[v1]: [MIRROR_DEBUG] Mirror-check task error: ${error.message}`);
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
  logger.silly('[v1]: [MIRROR_DEBUG] Starting runMirrorCheck function');

  const mirrorUrl = await getMirrorUrl();
  logger.silly(`[v1]: [MIRROR_DEBUG] Retrieved mirror URL: ${mirrorUrl}`);

  if (!mirrorUrl) {
    logger.info(
      'DATALAYER_FILE_SERVER_URL not set, skipping mirror announcements',
    );
    logger.silly('[v1]: [MIRROR_DEBUG] Exiting runMirrorCheck - no mirror URL');
    return;
  }

  // get governance info if governance node
  logger.silly('[v1]: [MIRROR_DEBUG] Checking for governance organization info');
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
    logger.silly('[v1]: [MIRROR_DEBUG] Adding governance mirrors');
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
    logger.silly('[v1]: [MIRROR_DEBUG] Completed governance mirror additions');
  } else {
    // Mirror governance stores for subscriber nodes that have a configured
    // GOVERNANCE_BODY_ID but are not governance body owners (no meta entries).
    const configGovernanceBodyId =
      getConfig().GOVERNANCE?.GOVERNANCE_BODY_ID;

    if (configGovernanceBodyId) {
      logger.debug(
        `[MIRROR_DEBUG] Subscriber node with v1 GOVERNANCE_BODY_ID: ${configGovernanceBodyId}, mirroring governance stores`,
      );

      try {
        await Organization.addMirror(configGovernanceBodyId, mirrorUrl, true);
        logger.debug(
          `[MIRROR_DEBUG] Mirror ensured for v1 governance body: ${configGovernanceBodyId}`,
        );
      } catch (error) {
        logger.error(
          `[MIRROR_DEBUG] Failed to mirror v1 governance body ${configGovernanceBodyId}: ${error.message}`,
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
            logger.debug(
              `[MIRROR_DEBUG] Mirror ensured for v1 governance version store: ${versionStoreId}`,
            );
          }
        } else {
          logger.debug(
            `[MIRROR_DEBUG] Could not resolve v1 governance version store from ${configGovernanceBodyId}`,
          );
        }
      } catch (error) {
        logger.error(
          `[MIRROR_DEBUG] Failed to resolve/mirror v1 governance version store: ${error.message}`,
        );
      }
    } else {
      logger.debug(
        '[MIRROR_DEBUG] Skipping governance mirrors - no governance data and no GOVERNANCE_BODY_ID configured',
      );
    }
  }

  logger.silly('[v1]: [MIRROR_DEBUG] Retrieving organizations map');
  const organizations = await Organization.getOrgsMap();
  logger.debug(
    `[MIRROR_DEBUG] Retrieved ${Object.keys(organizations).length} organizations from getOrgsMap()`,
  );
  logger.debug(
    `[MIRROR_DEBUG] Organizations: ${JSON.stringify(Object.keys(organizations))}`,
  );

  const orgs = Object.keys(organizations);
  logger.silly(`[v1]: [MIRROR_DEBUG] Processing ${orgs.length} organizations`);

  for (const org of orgs) {
    logger.silly(`[v1]: [MIRROR_DEBUG] Processing organization: ${org}`);
    const orgData = organizations[org];
    logger.debug(
      `[MIRROR_DEBUG] Organization data: ${JSON.stringify({
        name: orgData.name,
        subscribed: orgData.subscribed,
        orgUid: orgData.orgUid,
        dataModelVersionStoreId: orgData.dataModelVersionStoreId,
        registryId: orgData.registryId,
        fileStoreId: orgData.fileStoreId,
      })}`,
    );

    if (orgData.subscribed) {
      logger.debug(
        `[MIRROR_DEBUG] Organization ${org} is subscribed, adding mirrors`,
      );
      try {
        await Organization.addMirror(orgData.orgUid, mirrorUrl, true);
        logger.debug(
          `[MIRROR_DEBUG] Mirror ensured for orgUid: ${orgData.orgUid}`,
        );
      } catch (error) {
        logger.error(
          `[MIRROR_DEBUG] Failed to ensure mirror for orgUid ${orgData.orgUid}: ${error.message}`,
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
            `[MIRROR_DEBUG] Mirror ensured for dataModelVersionStoreId: ${orgData.dataModelVersionStoreId}`,
          );
        } catch (error) {
          logger.error(
            `[MIRROR_DEBUG] Failed to ensure mirror for dataModelVersionStoreId ${orgData.dataModelVersionStoreId}: ${error.message}`,
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
            `[MIRROR_DEBUG] Mirror ensured for registryId: ${orgData.registryId}`,
          );
        } catch (error) {
          logger.error(
            `[MIRROR_DEBUG] Failed to ensure mirror for registryId ${orgData.registryId}: ${error.message}`,
          );
        }
      } else {
        logger.debug(
          `[MIRROR_DEBUG] Skipping registryId mirror - value is null/undefined`,
        );
      }

      if (orgData.fileStoreId) {
        try {
          await Organization.addMirror(orgData.fileStoreId, mirrorUrl, true);
          logger.debug(
            `[MIRROR_DEBUG] Mirror ensured for fileStoreId: ${orgData.fileStoreId}`,
          );
        } catch (error) {
          logger.error(
            `[MIRROR_DEBUG] Failed to ensure mirror for fileStoreId ${orgData.fileStoreId}: ${error.message}`,
          );
        }
      } else {
        logger.debug(
          `[MIRROR_DEBUG] Skipping fileStoreId mirror - value is null/undefined`,
        );
      }
    } else {
      logger.debug(
        `[MIRROR_DEBUG] Organization ${org} is not subscribed, skipping`,
      );
    }
  }

  logger.silly('[v1]: [MIRROR_DEBUG] Completed runMirrorCheck function');
};

export default job;
export { runMirrorCheck };
