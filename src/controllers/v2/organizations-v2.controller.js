'use strict';

import _ from 'lodash';

import {
  OrganizationsV2,
  StagingV2,
  AuditV2,
  MethodologyV2,
  ProgramV2,
  ProjectV2,
  ValidationV2,
  VerificationV2,
  IssuanceV2,
  UnitV2,
  LocationV2,
  EstimationV2,
  RatingV2,
  CoBenefitV2,
  ProjectMethodologyV2,
  StakeholderV2,
  StakeholderProjectV2,
  LabelV2,
  UnitLabelV2,
  AefT1SubmissionV2,
  AefT5AuthorizedEntitiesV2,
  AefT2AuthorizationsV2,
  AefT3ActionsV2,
  AefT4HoldingsV2,
} from '../../models/v2/index.js';
import { Organization } from '../../models/organizations/organizations.model.js';
import { assertV2IfReadOnlyMode, assertV2HomeOrgExists, assertV2OrgDoesNotExist } from '../../utils/v2-data-assertions.js';
import { assertWalletIsSynced, assertStoreIsOwned } from '../../utils/data-assertions.js';
import { sequelizeV2 } from '../../database/v2/index.js';
import { loggerV2 } from '../../config/logger.js';
import datalayer from '../../datalayer';
import { getStoreData as getRawStoreData } from '../../datalayer/persistance.js';
import * as simulator from '../../datalayer/simulator.js';
import { decodeHex, decodeDataLayerResponse } from '../../utils/datalayer-utils.js';
import { getConfig } from '../../utils/config-loader.js';
import {
  tryAcquireOrgLock,
  releaseOrgLock,
  getOrgLockStatus,
} from '../../utils/org-operation-lock.js';
import { hasInProgressCreation } from '../../utils/organization-creation-state.js';

const { USE_SIMULATOR } = getConfig().APP;

const isReclaimConflictError = (error) => {
  const message = `${error?.message || ''}`.toLowerCase();
  const code = error?.parent?.code || error?.original?.code || error?.code;

  return (
    code === '40001'
    || code === '40P01'
    || code === '1213'
    || code === 'ER_LOCK_DEADLOCK'
    || code === 'SQLITE_BUSY'
    || message.includes('could not serialize access')
    || message.includes('serialization failure')
    || message.includes('deadlock')
    || message.includes('database is locked')
  );
};

// Helper to get store data - returns raw format with keys_values for both modes
// Uses simulator in simulator mode, otherwise uses persistance.getStoreData directly
// (syncService.getStoreData decodes data before callback, but we need raw hex format)
const getStoreDataPromise = async (storeId) => {
  if (USE_SIMULATOR) {
    return await simulator.getStoreData(storeId);
  } else {
    // Use raw persistance.getStoreData to get hex-encoded keys_values
    // (syncService.getStoreData decodes before callback, which breaks our checks)
    return await getRawStoreData(storeId);
  }
};

/**
 * Create V2 home organization (for new users only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const create = async (req, res) => {
  let lockToken = null;
  const releaseLock = () => { if (lockToken) { const t = lockToken; lockToken = null; releaseOrgLock(t); } };
  try {
    await assertV2IfReadOnlyMode();

    const { MetaV2: MetaV2Model } = await import('../../models/v2/index.js');
    if (await hasInProgressCreation(MetaV2Model, 'v2')) {
      return res.status(409).json({
        message: 'A V2 organization creation is still in progress (from a previous session). Check status at GET /v2/organizations/creation-status.',
        success: false,
      });
    }

    lockToken = tryAcquireOrgLock('V2 organization creation');
    if (!lockToken) {
      const lockStatus = getOrgLockStatus();
      return res.status(409).json({
        message: `A home organization operation is already in progress: ${lockStatus.operation}. Please wait for it to complete.`,
        operationStatus: lockStatus,
        success: false,
      });
    }

    const configV1 = getConfig();
    const enableV1 = configV1?.ENABLE !== false;

    if (enableV1) {
      const v1Org = await Organization.findOne({
        where: { isHome: true },
        raw: true,
      });

      if (v1Org) {
        if (v1Org.dataModelVersionStoreId) {
          try {
            const singletonData = await getStoreDataPromise(
              v1Org.dataModelVersionStoreId,
            );

            if (singletonData && !(singletonData instanceof Error) && singletonData.keys_values) {
              const hasV1Key = singletonData.keys_values.some((kv) => {
                try {
                  const decodedKey = decodeHex(kv.key);
                  return decodedKey === 'v1';
                } catch {
                  return false;
                }
              });

              if (hasV1Key) {
                releaseLock();
                return res.status(400).json({
                  message:
                    'V1 organization detected. Please use /v2/organizations/upgrade endpoint',
                  success: false,
                });
              }
            }
          } catch (error) {
            loggerV2.debug(`[v2]: Failed to check V1 singleton: ${error.message}`);
          }
        }

        releaseLock();
        return res.status(400).json({
          message:
            'V1 organization detected. Please use /v2/organizations/upgrade endpoint',
          success: false,
        });
      }
    }

    const existingV2Org = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });

    if (existingV2Org) {
      releaseLock();
      return res.status(400).json({
        message: 'V2 home organization already exists',
        success: false,
      });
    }

    const name = req.body.name || '';
    let icon = req.body.icon || '';

    if (req.file && req.file.buffer) {
      icon = `data:image/png;base64,${req.file.buffer.toString('base64')}`;
    }

    if (!name) {
      releaseLock();
      return res.status(400).json({
        message: 'Organization name is required',
        success: false,
      });
    }

    const { USE_SIMULATOR } = getConfig().APP;

    if (USE_SIMULATOR) {
      try {
        const orgUid = await OrganizationsV2.createHomeOrganization(name, icon, 'v2', lockToken);
        return res.json({
          message: 'V2 organization created successfully',
          orgUid,
          success: true,
        });
      } catch (error) {
        loggerV2.error(
          `[v2]: Error creating V2 home organization: ${error.message}`,
        );
        return res.status(400).json({
          message: 'Error creating V2 home organization',
          error: error.message,
          success: false,
        });
      } finally {
        releaseLock();
      }
    } else {
      const bgToken = lockToken;
      lockToken = null;
      OrganizationsV2.createHomeOrganization(name, icon, 'v2', bgToken)
        .catch((error) => {
          loggerV2.error(
            `[v2]: Error creating V2 home organization in background: ${error.message}`,
          );
        })
        .finally(() => {
          releaseOrgLock(bgToken);
        });

      return res.json({
        message:
          'New V2 organization is currently being created. It can take up to 30 mins. Please do not interrupt this process.',
        success: true,
      });
    }
  } catch (error) {
    releaseLock();
    loggerV2.error(`[v2]: Error creating V2 home organization: ${error.message}`);
    res.status(400).json({
      message: 'Error creating V2 home organization',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Upgrade from V1 to V2 organization (for existing V1 users)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const upgrade = async (req, res) => {
  let lockToken = null;
  const releaseLock = () => { if (lockToken) { const t = lockToken; lockToken = null; releaseOrgLock(t); } };
  try {
    await assertV2IfReadOnlyMode();

    const { MetaV2: MetaV2Model } = await import('../../models/v2/index.js');
    if (await hasInProgressCreation(MetaV2Model, 'v2')) {
      return res.status(409).json({
        message: 'A V2 organization creation is still in progress (from a previous session). Check status at GET /v2/organizations/creation-status.',
        success: false,
      });
    }

    lockToken = tryAcquireOrgLock('V1 to V2 upgrade');
    if (!lockToken) {
      const lockStatus = getOrgLockStatus();
      return res.status(409).json({
        message: `A home organization operation is already in progress: ${lockStatus.operation}. Please wait for it to complete.`,
        operationStatus: lockStatus,
        success: false,
      });
    }

    const configV1 = getConfig();
    const enableV1 = configV1?.ENABLE !== false;

    if (!enableV1) {
      releaseLock();
      return res.status(400).json({
        message: 'V1 is disabled. Cannot upgrade from V1 when V1 is not enabled.',
        success: false,
      });
    }

    const v1Org = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    if (!v1Org) {
      releaseLock();
      return res.status(400).json({
        message:
          'V1 home organization not found. Cannot upgrade without existing V1 organization.',
        success: false,
      });
    }

    if (!v1Org.dataModelVersionStoreId) {
      releaseLock();
      return res.status(400).json({
        message:
          'V1 organization is missing dataModelVersionStoreId. Organization creation may still be in progress.',
        success: false,
      });
    }

    const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    if (!v1Org.orgHash || v1Org.orgHash === nullHash || v1Org.orgHash === '0') {
      releaseLock();
      return res.status(400).json({
        message:
          'V1 organization orgHash is not populated. Organization creation has not completed writing data to the org store. Please wait for V1 organization creation to complete.',
        success: false,
      });
    }

    try {
      const singletonData = await getStoreDataPromise(v1Org.dataModelVersionStoreId);

      if (!singletonData || singletonData instanceof Error) {
        loggerV2.debug(`[v2]: Cannot read singleton data from ${v1Org.dataModelVersionStoreId}`);
        releaseLock();
        return res.status(400).json({
          message:
            'Cannot read V1 singleton data. V1 organization may still be creating or blockchain data is not yet available. Please wait and try again.',
          success: false,
        });
      }

      if (!singletonData.keys_values || singletonData.keys_values.length === 0) {
        loggerV2.debug(`[v2]: Singleton store ${v1Org.dataModelVersionStoreId} is empty`);
        releaseLock();
        return res.status(400).json({
          message:
            'V1 singleton store is empty. V1 organization creation has not completed writing data to the blockchain. Please wait for V1 organization creation to complete before upgrading.',
          success: false,
        });
      }

      const decodedData = decodeDataLayerResponse(singletonData);
      const singletonMap = decodedData.reduce((obj, current) => {
        obj[current.key] = current.value;
        return obj;
      }, {});

      if (!singletonMap.v1) {
        loggerV2.debug(`[v2]: Singleton store ${v1Org.dataModelVersionStoreId} missing v1 key`);
        releaseLock();
        return res.status(400).json({
          message:
            'V1 singleton store does not contain v1 key. V1 organization creation has not completed. Please wait for V1 organization creation to fully complete before upgrading.',
          success: false,
        });
      }

      loggerV2.info(`[v2]: V1 singleton validated - v1 key exists with registry ${singletonMap.v1}`);
    } catch (error) {
      loggerV2.error(`[v2]: Error validating V1 singleton: ${error.message}`);
      releaseLock();
      return res.status(400).json({
        message:
          `Cannot validate V1 organization singleton store: ${error.message}. Please ensure V1 organization creation is complete before upgrading.`,
        success: false,
      });
    }

    const existingV2Org = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });

    if (existingV2Org && v1Org.dataModelVersionStoreId) {
      try {
        const singletonData = await getStoreDataPromise(v1Org.dataModelVersionStoreId);
        if (singletonData && !(singletonData instanceof Error) && singletonData.keys_values) {
          const decodedData = decodeDataLayerResponse(singletonData);
          const singletonMap = decodedData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});

          if (singletonMap.v2 !== undefined) {
            releaseLock();
            return res.status(400).json({
              message: 'V2 home organization already exists and upgrade is already complete.',
              success: false,
            });
          }
        }
      } catch (error) {
        loggerV2.debug(`[v2]: Failed to check singleton for v2 key: ${error.message}`);
      }
    }

    const name = v1Org.name || '';
    const icon = v1Org.icon || '';

    if (USE_SIMULATOR) {
      try {
        await OrganizationsV2.upgradeFromV1(name, icon, lockToken);
        return res.json({
          message: 'V2 organization upgrade completed successfully.',
          success: true,
        });
      } catch (error) {
        loggerV2.error(`[v2]: Error upgrading V2 organization: ${error.message}`);
        return res.status(400).json({
          message: 'Error upgrading to V2 organization',
          error: error.message,
          success: false,
        });
      } finally {
        releaseLock();
      }
    } else {
      const bgToken = lockToken;
      lockToken = null;
      OrganizationsV2.upgradeFromV1(name, icon, bgToken)
        .catch((error) => {
          loggerV2.error(
            `[v2]: Error upgrading V2 organization in background: ${error.message}`,
          );
        })
        .finally(() => {
          releaseOrgLock(bgToken);
        });

      return res.json({
        message:
          'V2 organization upgrade is currently being processed. It can take up to 30 mins. Please do not interrupt this process.',
        success: true,
      });
    }
  } catch (error) {
    releaseLock();
    loggerV2.error(`[v2]: Error upgrading to V2 organization: ${error.message}`);
    res.status(400).json({
      message: 'Error upgrading to V2 organization',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Get all organizations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const findAll = async (req, res) => {
  try {
    const orgsMap = await OrganizationsV2.getOrgsMap();
    return res.json(orgsMap);
  } catch (error) {
    loggerV2.error(`[v2]: Error retrieving organizations: ${error.message}`);
    res.status(400).json({
      message: 'Error retrieving organizations',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Get home organization sync status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const homeOrgSyncStatus = async (req, res) => {
  try {
    await assertV2HomeOrgExists();
    await assertWalletIsSynced();

    const homeOrg = await OrganizationsV2.getHomeOrg();
    const pendingCommitsCount = await StagingV2.count({
      where: { committed: true },
    });

    // In simulator mode, assume wallet is synced and profile is synced
    let walletSynced = true;
    let homeOrgProfileSynced = true;

    if (!USE_SIMULATOR) {
      walletSynced = await datalayer.walletIsSynced();

      // Get sync status - may fail or return undefined if store isn't synced yet
      try {
        const syncResult = await datalayer.getDataLayerStoreSyncStatus(homeOrg.org_uid);
        const syncStatus = syncResult?.sync_status;

        if (syncStatus && syncStatus.target_root_hash !== undefined) {
          homeOrgProfileSynced =
            syncStatus.target_root_hash === homeOrg.org_hash?.split('0x')?.[1];
        } else {
          // Store not synced yet or sync status not available
          homeOrgProfileSynced = false;
        }
      } catch (syncError) {
        // Sync status not available yet - store might still be initializing
        loggerV2.debug(`[v2]: Could not get sync status for home org: ${syncError.message}`);
        homeOrgProfileSynced = false;
      }
    }

    return res.json({
      ready:
        walletSynced && Boolean(homeOrg?.synced) && pendingCommitsCount === 0,
      status: {
        wallet_synced: walletSynced,
        home_org_synced: Boolean(homeOrg?.synced),
        pending_commits: pendingCommitsCount,
        home_org_profile_synced: homeOrgProfileSynced,
      },
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error getting home org sync status: ${error.message}`);
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

/**
 * Get organization creation status
 * Returns the status of any in-progress or recently completed/failed organization creation.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCreationStatus = async (req, res) => {
  try {
    const metaStatus = await OrganizationsV2.getCreationStatus();
    const lockStatus = getOrgLockStatus();

    return res.json({
      ...metaStatus,
      ...(lockStatus && !metaStatus.inProgress ? {
        inProgress: true,
        message: `${lockStatus.operation}: ${lockStatus.status}`,
        operation: lockStatus.operation,
        status: lockStatus.status,
        startedAt: lockStatus.startedAt,
        elapsedSeconds: lockStatus.elapsedSeconds,
      } : {}),
      ...(lockStatus ? { liveStatus: lockStatus } : {}),
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error getting creation status: ${error.message}`);
    res.status(400).json({
      message: 'Error getting organization creation status',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Edit home organization (name and/or icon)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const editHomeOrg = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertWalletIsSynced();
    await assertV2HomeOrgExists();

    const { name } = req.body;

    let icon;

    if (req.file) {
      const buffer = req.file.buffer;
      icon = `data:image/png;base64, ${buffer.toString('base64')}`;
    } else {
      icon = '';
    }

    await OrganizationsV2.editOrgMeta({ name, icon });

    return res.json({
      message: 'Home org currently being updated, will be completed soon.',
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error editing home organization: ${error.message}`);
    res.status(400).json({
      message: 'Error initiating your organization',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Add metadata to home organization
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const addMetadata = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertWalletIsSynced();
    await assertV2HomeOrgExists();

    await OrganizationsV2.addMetadata(req.body);

    return res.json({
      message: 'Home org currently being updated, will be completed soon.',
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error adding metadata to organization: ${error.message}`);
    res.status(400).json({
      message: 'Error adding metadata to your organization',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Get metadata for an organization
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getMetaData = async (req, res) => {
  try {
    await assertWalletIsSynced();

    const { orgUid } = req.query;

    if (!orgUid) {
      return res.status(400).json({
        message: 'orgUid query parameter is required',
        success: false,
      });
    }

    const organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });

    if (!organization) {
      return res.status(404).json({
        message: 'Organization not found',
        success: false,
      });
    }

    if (!organization.metadata) {
      return res.json({});
    }

    const rawMetadata = JSON.parse(organization.metadata);
    const cleanedMetadata = {};

    for (const [key, value] of Object.entries(rawMetadata)) {
      const newKey = key.startsWith('meta_') ? key.substring(5) : key;
      cleanedMetadata[newKey] = value;
    }

    return res.json(cleanedMetadata);
  } catch (error) {
    loggerV2.error(`[v2]: Error getting metadata for organization: ${error.message}`);
    res.status(400).json({
      message: 'Error getting metadata for organization',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Import organization from datalayer
 * POST /v2/organizations/import
 */
export const importOrganization = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertWalletIsSynced();

    const { orgUid, isHome } = req.body;

    if (!orgUid) {
      return res.status(400).json({
        message: 'orgUid is required',
        success: false,
      });
    }

    await assertV2OrgDoesNotExist(orgUid);

    await OrganizationsV2.importOrganization(orgUid, isHome || false);

    return res.status(200).json({
      message: `Successfully imported ${isHome ? 'home' : ''} organization. CADT will begin syncing data from datalayer shortly`,
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error importing organization: ${error.message}`);
    res.status(400).json({
      message: 'Error importing organization',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Subscribe to organization
 * POST /v2/organizations/subscribe
 */
export const subscribeToOrganization = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertWalletIsSynced();

    const { orgUid } = req.body;

    if (!orgUid) {
      return res.status(400).json({
        message: 'orgUid is required',
        success: false,
      });
    }

    await OrganizationsV2.subscribeToOrganization(orgUid);

    return res.json({
      message: 'Subscribed to organization',
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error subscribing to organization: ${error.message}`);
    res.status(400).json({
      message: 'Error subscribing to organization',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Unsubscribe from organization
 * POST /v2/organizations/unsubscribe
 */
export const unsubscribeFromOrganization = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertWalletIsSynced();

    const { orgUid } = req.body;

    if (!orgUid) {
      return res.status(400).json({
        message: 'orgUid is required',
        success: false,
      });
    }

    const organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });

    if (organization?.is_home) {
      throw new Error(
        `you cannot unsubscribe from your home organization. orgUid: ${orgUid}`,
      );
    }

    if (organization) {
      // Organization exists in database - mark as unsubscribed and unsubscribe from stores
      await OrganizationsV2.unsubscribeFromOrganizationStores(organization);
      return res.json({
        message:
          'Organization has been marked as unsubscribed. CADT will remove the datalayer subscriptions shortly.',
        success: true,
      });
    } else {
      // Organization doesn't exist in database - check datalayer subscriptions
      // In simulator mode, return empty subscriptions list
      let subscriptions = [];
      let successGettingSubscriptions = true;
      if (!USE_SIMULATOR) {
        const { getSubscriptions } = await import('../../datalayer/persistance.js');
        const result = await getSubscriptions();
        subscriptions = result.storeIds || [];
        successGettingSubscriptions = result.success || false;
      }
      if (!successGettingSubscriptions) {
        throw new Error('failed to get subscribed stores from datalayer');
      }

      if (!subscriptions.includes(orgUid)) {
        return res.json({
          message: `you are not subscribed to organization ${orgUid}`,
          success: true,
        });
      }

      // Get org store data to find dataModelVersionStoreId and registryId
      let orgStoreData;
      if (USE_SIMULATOR) {
        const storeData = await getStoreDataPromise(orgUid);
        if (storeData && storeData.keys_values) {
          const decodedData = decodeDataLayerResponse(storeData);
          orgStoreData = decodedData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});
        } else {
          throw new Error(`Failed to get org store data from ${orgUid} in simulator mode`);
        }
      } else {
        orgStoreData = await datalayer.getCurrentStoreData(orgUid);
      }

      const dataModelVersionStoreId = orgStoreData?.registryId;
      if (!dataModelVersionStoreId) {
        throw new Error(
          `cannot get data model singleton id from store ${orgUid}. not an organization store or a datalayer error occurred`,
        );
      }

      // Get registry store ID from singleton (must be v2 for V2 system)
      const registryStoreId = await OrganizationsV2.getRegistryStoreIdFromSingleton(
        dataModelVersionStoreId,
        'v2',
      );

      // Unsubscribe from stores
      await OrganizationsV2.unsubscribeFromOrganizationStores({
        org_uid: orgUid,
        data_model_version_store_id: dataModelVersionStoreId,
        registry_id: registryStoreId,
      });

      return res.json({
        message: 'Unsubscribed from organization datalayer stores',
        success: true,
      });
    }
  } catch (error) {
    loggerV2.error(`[v2]: Error unsubscribing from organization: ${error.message}`);
    res.status(400).json({
      message: 'Error unsubscribing from organization datalayer stores',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Resync organization - reconcile and delete all data, then resync from datalayer
 * POST /v2/organizations/resync
 */
export const resyncOrganization = async (req, res) => {
  let transaction;
  try {
    await assertV2IfReadOnlyMode();
    await assertWalletIsSynced();

    const { orgUid } = req.body;

    if (!orgUid) {
      return res.status(400).json({
        message: 'orgUid is required',
        success: false,
      });
    }

    transaction = await sequelizeV2.transaction();

    const organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });

    if (!organization) {
      throw new Error(`organization ${orgUid} does not exist on this instance`);
    }

    if (!organization.subscribed) {
      throw new Error(
        `you are not subscribed to this organization. please subscribe to resync`,
      );
    }

    // Reconcile organization (updates database with datalayer data)
    await OrganizationsV2.reconcileOrganization(organization);

    // Reset registry hash
    await OrganizationsV2.update(
      { registry_hash: '0' },
      { where: { org_uid: orgUid }, transaction },
    );

    // Delete all V2 data for this organization
    // Note: Only AuditV2 has org_uid field. Other V2 data models don't have org_uid
    // and are associated with organizations through the registry, not directly.
    // For resync, we only delete from AuditV2 which tracks organization-specific audit data.
    await AuditV2.destroy({
      where: { org_uid: orgUid },
      transaction,
    });

    await transaction.commit();

    return res.json({
      message: 'Resyncing organization process initiated',
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error resyncing organization: ${error.message}`);
    res.status(400).json({
      message: 'Error resyncing organization',
      error: error.message,
      success: false,
    });

    if (transaction) {
      await transaction.rollback();
    }
  }
};

/**
 * Delete organization - remove all V2 data for organization
 * DELETE /v2/organizations/:orgUid
 */
export const deleteOrganization = async (req, res) => {
  const { orgUid } = req.params;

  try {
    await assertV2IfReadOnlyMode();

    const organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });

    if (!organization) {
      throw new Error(
        `organization with orgUid ${orgUid} does not exist on this instance`,
      );
    }

    await OrganizationsV2.deleteAllOrganizationData(orgUid);

    if (organization.is_home) {
      return res.json({
        message:
          'Your home organization was deleted from this instance. CADT will no longer sync its data. (note that this org still exists in datalayer)',
        success: true,
      });
    }

    try {
      // Need to call this here because the task that normally unsubscribes cannot if there's no record of the organization
      await OrganizationsV2.unsubscribeFromOrganizationStores(organization);
    } catch (error) {
      return res.status(400).json({
        message: `Removed all organization records for organization ${orgUid} from CADT, but an error prevented unsubscribing from the organization on datalayer`,
        error: error.message,
        success: false,
      });
    }

    return res.json({
      message: `Removed all organization records for organization ${orgUid} and unsubscribed from organization datalayer stores. CADT will not sync the organizations data from datalayer`,
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error deleting organization: ${error.message}`);
    res.status(400).json({
      message: 'Error deleting organization',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Sync organization metadata - sync metadata for all subscribed organizations
 * POST /v2/organizations/sync
 */
export const sync = async (req, res) => {
  try {
    // Optional: check read-only mode (sync is typically read-only operation)
    // await assertV2IfReadOnlyMode();

    await OrganizationsV2.syncOrganizationMeta();

    return res.json({
      message: 'Organization metadata sync initiated',
      success: true,
    });
  } catch (error) {
    loggerV2.error(`[v2]: Error syncing organization metadata: ${error.message}`);
    res.status(400).json({
      message: 'Error syncing organization metadata',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Add mirror for a store
 * POST /v2/organizations/mirror
 */
export const addMirror = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertWalletIsSynced();
    await assertV2HomeOrgExists();

    const { storeId, url } = req.body;

    if (!storeId) {
      return res.status(400).json({
        message: 'storeId is required',
        success: false,
      });
    }

    if (!url) {
      return res.status(400).json({
        message: 'url is required',
        success: false,
      });
    }

    const result = await OrganizationsV2.addMirror(storeId, url);

    if (result) {
      return res.json({
        message: `Mirror added for ${storeId}.`,
        success: true,
      });
    } else {
      return res.status(400).json({
        message: `Failed to add mirror for ${storeId}`,
        success: false,
      });
    }
  } catch (error) {
    loggerV2.error(`[v2]: Error adding mirror: ${error.message}`);
    res.status(400).json({
      message: 'Error adding mirror',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Remove mirror for a store
 * POST /v2/organizations/remove-mirror
 */
export const removeMirror = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertWalletIsSynced();
    await assertV2HomeOrgExists();

    const { storeId, coinId } = req.body;

    if (!storeId) {
      return res.status(400).json({
        message: 'storeId is required',
        success: false,
      });
    }

    if (!coinId) {
      return res.status(400).json({
        message: 'coinId is required',
        success: false,
      });
    }

    const result = await OrganizationsV2.removeMirror(storeId, coinId);

    if (result) {
      return res.json({
        message: `Mirror removed for ${storeId}.`,
        success: true,
      });
    } else {
      return res.status(400).json({
        message: `Failed to remove mirror for ${storeId}. Mirror may not exist.`,
        success: false,
      });
    }
  } catch (error) {
    loggerV2.error(`[v2]: Error removing mirror: ${error.message}`);
    res.status(400).json({
      message: 'Error removing mirror',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Reclaim an existing V2 organization as the home organization.
 * Verifies store ownership and singleton integrity before promoting.
 * @param {Object} req - Express request object with { orgUid } in body
 * @param {Object} res - Express response object
 */
export const reclaimHome = async (req, res) => {
  let lockToken = null;
  const releaseLock = () => { if (lockToken) { const t = lockToken; lockToken = null; releaseOrgLock(t); } };
  try {
    await assertV2IfReadOnlyMode();

    lockToken = tryAcquireOrgLock('V2 home organization reclaim');
    if (!lockToken) {
      const lockStatus = getOrgLockStatus();
      return res.status(409).json({
        message: `A home organization operation is already in progress: ${lockStatus.operation}. Please wait for it to complete.`,
        operationStatus: lockStatus,
        success: false,
      });
    }

    try {
    await assertWalletIsSynced();
    const { orgUid } = req.body;

    const org = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });

    if (!org) {
      return res.status(404).json({
        message: `V2 organization ${orgUid} not found.`,
        success: false,
      });
    }

    if (org.is_home) {
      return res.json({
        message: `V2 organization ${orgUid} is already the home organization.`,
        success: true,
      });
    }

    const existingHome = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });

    if (existingHome) {
      return res.status(409).json({
        message: `Another V2 organization (${existingHome.org_uid}) is already set as home. Remove or resolve it before reclaiming.`,
        success: false,
      });
    }

    const pendingOrg = await OrganizationsV2.findOne({
      where: { org_uid: 'PENDING' },
      raw: true,
    });

    if (pendingOrg) {
      return res.status(409).json({
        message: 'A V2 organization creation is currently in progress. Wait for it to complete before reclaiming.',
        success: false,
      });
    }

    await assertStoreIsOwned(orgUid);

    if (!org.registry_id) {
      return res.status(400).json({
        message: 'V2 organization is missing registry_id. Organization data may be incomplete.',
        success: false,
      });
    }
    await assertStoreIsOwned(org.registry_id);

    if (!org.data_model_version_store_id) {
      return res.status(400).json({
        message: 'V2 organization is missing data_model_version_store_id. Organization data may be incomplete.',
        success: false,
      });
    }
    await assertStoreIsOwned(org.data_model_version_store_id);

    const nullHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    if (!org.org_hash || org.org_hash === '0' || org.org_hash === nullHash) {
      return res.status(400).json({
        message: 'V2 organization org_hash is not populated. Organization creation may not have completed.',
        success: false,
      });
    }

    const singletonData = await getStoreDataPromise(org.data_model_version_store_id);

    if (!singletonData || singletonData instanceof Error || !singletonData.keys_values?.length) {
      return res.status(400).json({
        message: 'Cannot read singleton store data. Organization may be incomplete or blockchain data unavailable.',
        success: false,
      });
    }

    const decodedData = decodeDataLayerResponse(singletonData);
    const singletonMap = decodedData.reduce((obj, current) => {
      obj[current.key] = current.value;
      return obj;
    }, {});

    if (!singletonMap.v2) {
      return res.status(400).json({
        message: 'Singleton store does not contain a v2 key. Not a valid V2 home organization.',
        success: false,
      });
    }

    if (singletonMap.v2 !== org.registry_id) {
      return res.status(400).json({
        message: `Singleton v2 registry (${singletonMap.v2}) does not match organization registry_id (${org.registry_id}). On-chain data is inconsistent with the database.`,
        success: false,
      });
    }

    const transaction = await sequelizeV2.transaction({
      isolationLevel: 'SERIALIZABLE',
    });
    try {
      const lockOptions = sequelizeV2.getDialect() === 'sqlite'
        ? {}
        : { lock: transaction.LOCK.UPDATE };

      const existingHomeTx = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
        transaction,
        ...lockOptions,
      });

      if (existingHomeTx) {
        await transaction.rollback();
        if (existingHomeTx.org_uid === orgUid) {
          return res.json({
            message: `V2 organization ${orgUid} is already the home organization.`,
            success: true,
          });
        }

        return res.status(409).json({
          message: `Another V2 organization (${existingHomeTx.org_uid}) is already set as home. Remove or resolve it before reclaiming.`,
          success: false,
        });
      }

      const [updatedCount] = await OrganizationsV2.update(
        { is_home: true },
        { where: { org_uid: orgUid, is_home: false }, transaction },
      );

      if (updatedCount === 0) {
        await transaction.rollback();
        return res.status(409).json({
          message: 'V2 organization could not be reclaimed because home state changed during request processing. Retry the request.',
          success: false,
        });
      }

      await transaction.commit();
    } catch (txError) {
      await transaction.rollback();
      if (isReclaimConflictError(txError)) {
        return res.status(409).json({
          message: 'V2 organization could not be reclaimed because a concurrent request updated home state. Retry the request.',
          success: false,
        });
      }
      throw txError;
    }

    loggerV2.info(`[v2]: Organization ${orgUid} reclaimed as home organization`);

    return res.json({
      message: `V2 organization ${orgUid} has been reclaimed as the home organization.`,
      success: true,
    });
    } finally {
      releaseLock();
    }
  } catch (error) {
    releaseLock();
    loggerV2.error(`[v2]: Error reclaiming home organization: ${error.message}`);
    res.status(400).json({
      message: 'Error reclaiming home organization',
      error: error.message,
      success: false,
    });
  }
};

