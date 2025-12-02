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
import { assertWalletIsSynced } from '../../utils/data-assertions.js';
import { sequelizeV2 } from '../../database/v2/index.js';
import { loggerV2 } from '../../config/logger.js';
import datalayer from '../../datalayer';
import * as simulator from '../../datalayer/simulator.js';
import { decodeHex, decodeDataLayerResponse } from '../../utils/datalayer-utils.js';
import { getConfig } from '../../utils/config-loader.js';

const { USE_SIMULATOR } = getConfig().APP;

// Helper to get store data - uses simulator in simulator mode, otherwise wraps callback-based version
const getStoreDataPromise = async (storeId) => {
  if (USE_SIMULATOR) {
    return await simulator.getStoreData(storeId);
  } else {
    return new Promise((resolve, reject) => {
      datalayer.getStoreData(
        storeId,
        (data) => resolve(data),
        (error) => reject(new Error(error)),
      );
    });
  }
};

/**
 * Create V2 home organization (for new users only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();

    // Check if V1 home org exists in database
    const v1Org = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    if (v1Org) {
      // V1 org exists - check for V1 singleton in datalayer
      if (v1Org.dataModelVersionStoreId) {
        try {
          const singletonData = await getStoreDataPromise(
            v1Org.dataModelVersionStoreId,
          );

          // Handle simulator mode - getStoreData might return Error object or false
          if (singletonData && !(singletonData instanceof Error) && singletonData.keys_values) {
            // Check if singleton has v1 key
            const hasV1Key = singletonData.keys_values.some((kv) => {
              try {
                const decodedKey = decodeHex(kv.key);
                return decodedKey === 'v1';
              } catch {
                return false;
              }
            });

            if (hasV1Key) {
              return res.status(400).json({
                message:
                  'V1 organization detected. Please use /v2/organizations/upgrade endpoint',
                success: false,
              });
            }
          }
        } catch (error) {
          // If getStoreData fails, we still error because V1 org exists
          loggerV2.debug(`[v2]: Failed to check V1 singleton: ${error.message}`);
        }
      }

      // If V1 org exists but no singleton check possible, still error
      return res.status(400).json({
        message:
          'V1 organization detected. Please use /v2/organizations/upgrade endpoint',
        success: false,
      });
    }

    // Check if V2 home org already exists
    const existingV2Org = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });

    if (existingV2Org) {
      return res.status(400).json({
        message: 'V2 home organization already exists',
        success: false,
      });
    }

    // Extract name and icon from request
    // Support both JSON body and file upload for icon
    const name = req.body.name || '';
    const icon = req.body.icon || req.file?.buffer?.toString('base64') || '';

    if (!name) {
      return res.status(400).json({
        message: 'Organization name is required',
        success: false,
      });
    }

    // Call createHomeOrganization
    const orgUid = await OrganizationsV2.createHomeOrganization(name, icon, 'v2');

    res.json({
      message: 'V2 home organization created successfully',
      orgUid,
      success: true,
    });
  } catch (error) {
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
  try {
    await assertV2IfReadOnlyMode();
    // Note: assertWalletIsSyncedV2 and assertNoPendingCommitsExcludingTransfers don't exist yet
    // await assertWalletIsSyncedV2();
    // await assertNoPendingCommitsExcludingTransfers();

    // Check if V1 home org exists
    const v1Org = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    if (!v1Org) {
      return res.status(400).json({
        message:
          'V1 home organization not found. Cannot upgrade without existing V1 organization.',
        success: false,
      });
    }

    // Check if V2 home org already exists
    const existingV2Org = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });

    if (existingV2Org) {
      return res.status(400).json({
        message: 'V2 home organization already exists. Already upgraded.',
        success: false,
      });
    }

    // Get name and icon from V1 org
    const name = v1Org.name || '';
    const icon = v1Org.icon || '';

    // Call upgradeFromV1
    const orgUid = await OrganizationsV2.upgradeFromV1(name, icon);

    res.json({
      message: 'V2 organization upgraded successfully from V1',
      orgUid,
      success: true,
    });
  } catch (error) {
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

    const walletSynced = await datalayer.walletIsSynced();
    const homeOrg = await OrganizationsV2.getHomeOrg();
    const pendingCommitsCount = await StagingV2.count({
      where: { committed: true },
    });

    const { sync_status } = await datalayer.getSyncStatus(homeOrg.org_uid);

    return res.json({
      ready:
        walletSynced && Boolean(homeOrg?.synced) && pendingCommitsCount === 0,
      status: {
        wallet_synced: walletSynced,
        home_org_synced: Boolean(homeOrg?.synced),
        pending_commits: pendingCommitsCount,
        home_org_profile_synced:
          sync_status.target_root_hash === homeOrg.org_hash?.split('0x')?.[1],
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

