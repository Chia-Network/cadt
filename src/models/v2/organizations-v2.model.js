'use strict';

import { Sequelize, Model } from 'sequelize';
import _ from 'lodash';

import { sequelizeV2 } from '../../database/v2/index.js';
import datalayer from '../../datalayer';
import * as simulator from '../../datalayer/simulator.js';
import { loggerV2 } from '../../config/logger.js';
import { getConfig } from '../../utils/config-loader';
import { decodeHex, decodeDataLayerResponse } from '../../utils/datalayer-utils.js';
const { USE_SIMULATOR, AUTO_SUBSCRIBE_FILESTORE } = getConfig().APP;

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

// Import V1 Organization model to check for existing V1 org
import { Organization } from '../organizations/organizations.model.js';
// Import V2 Staging model for pending commits check
import StagingV2 from './staging-v2.model.js';
// Import utilities for import and subscription operations
import { FileStore } from '../index.js';
import { assertStoreIsOwned } from '../../utils/data-assertions.js';
import {
  getRoot,
  getSubscriptions,
} from '../../datalayer/persistance.js';
import {
  addOrDeleteOrganizationRecordMutex,
  processingSyncRegistriesTransactionMutex,
} from '../../utils/model-utils.js';
import { isDlStoreSynced } from '../../utils/datalayer-utils.js';

import ModelTypes from './organizations-v2.modeltypes.cjs';

class OrganizationsV2 extends Model {
  /**
   * Create a V2 home organization (for new users only)
   * @param {string} name - Organization name
   * @param {string} icon - Organization icon (base64 string)
   * @param {string} dataVersion - Data version (defaults to 'v2')
   * @returns {Promise<string>} The new organization UID
   * @throws {Error} If V1 org exists or V2 org already exists
   */
  static async createHomeOrganization(name, icon, dataVersion = 'v2') {
    try {
      loggerV2.info('[v2]: Creating New V2 Organization, This could take a while.');

      // Check for existing V2 home org
      const existingV2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      if (existingV2Org) {
        loggerV2.info('[v2]: V2 home organization already exists');
        return existingV2Org.org_uid;
      }

      // CRITICAL: Check for V1 home org in database
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
              // keys_values is an array of {key: hex, value: hex} objects
              const hasV1Key = singletonData.keys_values.some((kv) => {
                try {
                  const decodedKey = decodeHex(kv.key);
                  return decodedKey === 'v1';
                } catch {
                  return false;
                }
              });

              if (hasV1Key) {
                throw new Error(
                  'V1 organization detected. Please use /v2/organizations/upgrade endpoint',
                );
              }
            }
          } catch (error) {
            // If getStoreData fails, we still error because V1 org exists
            loggerV2.debug(`[v2]: Failed to check V1 singleton: ${error.message}`);
          }
        }

        // If V1 org exists but no singleton check possible, still error
        throw new Error(
          'V1 organization detected. Please use /v2/organizations/upgrade endpoint',
        );
      }

      // Create PENDING record
      await OrganizationsV2.create({
        org_uid: 'PENDING',
        registry_id: null,
        data_model_version_store_id: null,
        is_home: true,
        subscribed: false,
        name: '',
        icon: '',
      });

      loggerV2.verbose('[v2]: createHomeOrg() is creating organization (orgUid) store');
      const newOrganizationId = USE_SIMULATOR
        ? 'f1c54511-865e-4611-976c-7c3c1f704662'
        : await datalayer.createDataLayerStore();

      loggerV2.verbose('[v2]: createHomeOrg() is creating registryId store');
      const registryStoreId = USE_SIMULATOR
        ? 'e9241e7e-b4bd-4cde-ae35-5b42235f9d3b'
        : await datalayer.createDataLayerStore();

      loggerV2.verbose('[v2]: createHomeOrg() is creating dataModelVersionId store');
      const dataModelVersionStoreId = USE_SIMULATOR
        ? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
        : await datalayer.createDataLayerStore();

      loggerV2.verbose('[v2]: createHomeOrg() is creating file store');
      const fileStoreId = USE_SIMULATOR
        ? 'f1a2b3c4-d5e6-7890-abcd-ef1234567890'
        : await datalayer.createDataLayerStore();

      const revertOrganizationIfFailed = async () => {
        loggerV2.error(
          '[v2]: create V2 organization process failed. removing failed home organization records. please try again',
        );
        await Promise.all([
          OrganizationsV2.destroy({ where: { org_uid: newOrganizationId } }),
          OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } }),
        ]);
      };

      if (!USE_SIMULATOR) {
        loggerV2.info(
          '[v2]: create V2 organization process is waiting for all store creations to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      loggerV2.verbose(
        `[v2]: the blockchain reported new V2 organization stores orgUid: ${newOrganizationId}, ` +
          `dataModelVersionStore: ${dataModelVersionStoreId}, registryId: ${registryStoreId} have confirmed. `,
      );
      loggerV2.info(
        `[v2]: committing V2 organization data to orgUid store ${newOrganizationId}`,
      );

      // Sync the organization store
      await datalayer.syncDataLayer(
        newOrganizationId,
        {
          registryId: dataModelVersionStoreId, // Points to singleton
          fileStoreId,
          name,
          icon,
        },
        revertOrganizationIfFailed,
      );

      if (!USE_SIMULATOR) {
        loggerV2.info(
          '[v2]: create V2 organization process is waiting for organization data committed to orgUid store to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      loggerV2.info(
        `[v2]: committing registry data model version data to data model version store ${dataModelVersionStoreId}`,
      );

      // CRITICAL: Create singleton with only v2 key (not v1)
      await datalayer.syncDataLayer(
        dataModelVersionStoreId,
        {
          [dataVersion]: registryStoreId, // Only v2 key for new users
        },
        revertOrganizationIfFailed,
      );

      if (!USE_SIMULATOR) {
        loggerV2.info(
          '[v2]: create V2 organization process is waiting for data model version to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      loggerV2.info('[v2]: adding new V2 home organization to CADT database');
      await Promise.all([
        OrganizationsV2.create({
          org_uid: newOrganizationId,
          data_model_version_store_id: dataModelVersionStoreId,
          registry_id: registryStoreId,
          is_home: true,
          subscribed: USE_SIMULATOR,
          file_store_subscribed: fileStoreId,
          name,
          icon,
        }),
        OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } }),
      ]);

      const onConfirm = async () => {
        loggerV2.info('[v2]: V2 Organization confirmed, you are ready to go');
        await OrganizationsV2.update(
          {
            subscribed: true,
          },
          { where: { org_uid: newOrganizationId } },
        );
      };

      if (!USE_SIMULATOR) {
        loggerV2.info('[v2]: Waiting for New V2 Organization to be confirmed');
        // In non-simulator mode, use callback-based getStoreData to wait for confirmation
        datalayer.getStoreData(
          newOrganizationId,
          onConfirm,
          revertOrganizationIfFailed,
        );
      } else {
        // In simulator mode, data is immediately available
        // Await the update to ensure it completes before returning
        await onConfirm();
      }

      return newOrganizationId;
    } catch (error) {
      loggerV2.error(
        `[v2]: create V2 organization process failed. removing failed home organization records. please try again. Error: ${error.message}`,
      );
      await OrganizationsV2.destroy({ where: { is_home: true } });
      throw error;
    }
  }

  /**
   * Upgrade from V1 to V2 organization (for existing V1 users)
   * Creates a V2 home org based on existing V1 org, sharing the dataModelVersionStoreId singleton
   * @param {string} name - Organization name (from V1 org)
   * @param {string} icon - Organization icon (from V1 org)
   * @returns {Promise<string>} The new V2 organization UID
   * @throws {Error} If V1 org doesn't exist or V2 org already exists
   */
  static async upgradeFromV1(name, icon) {
    try {
      loggerV2.info('[v2]: Upgrading from V1 to V2 Organization, This could take a while.');

      // CRITICAL: Check if V1 home org exists
      const v1Org = await Organization.findOne({
        where: { isHome: true },
        raw: true,
      });

      if (!v1Org) {
        throw new Error(
          'V1 home organization not found. Cannot upgrade without existing V1 organization.',
        );
      }

      // CRITICAL: Check if V2 home org already exists
      const existingV2Org = await OrganizationsV2.findOne({
        where: { is_home: true },
        raw: true,
      });

      if (existingV2Org) {
        throw new Error(
          'V2 home organization already exists. Cannot upgrade again.',
        );
      }

      // Get V1 org data
      const v1OrgUid = v1Org.orgUid;
      const v1RegistryId = v1Org.registryId;
      const v1FileStoreId = v1Org.fileStoreId;
      const v1DataModelVersionStoreId = v1Org.dataModelVersionStoreId;

      if (!v1DataModelVersionStoreId) {
        throw new Error(
          'V1 organization missing dataModelVersionStoreId. Cannot upgrade.',
        );
      }

      // CRITICAL: Read current singleton data from datalayer
      const singletonData = await getStoreDataPromise(
        v1DataModelVersionStoreId,
      );

      if (!singletonData || !singletonData.keys_values) {
        throw new Error(
          'Cannot read V1 singleton data from datalayer. Cannot upgrade.',
        );
      }

      // Decode singleton to get v1 registry store ID
      const decodedSingleton = {};
      singletonData.keys_values.forEach((kv) => {
        try {
          const decodedKey = decodeHex(kv.key);
          const decodedValue = decodeHex(kv.value);
          decodedSingleton[decodedKey] = decodedValue;
        } catch (error) {
          loggerV2.warn(`[v2]: Failed to decode singleton key/value: ${error.message}`);
        }
      });

      const v1RegistryStoreId = decodedSingleton.v1;
      if (!v1RegistryStoreId) {
        throw new Error(
          'V1 singleton missing v1 key. Cannot upgrade without v1 registry store ID.',
        );
      }

      // Create new V2 stores (completely new store IDs, different from V1)
      loggerV2.verbose('[v2]: upgradeFromV1() is creating new V2 orgUid store');
      const newV2OrgUid = USE_SIMULATOR
        ? 'v2-org-uid-' + Date.now()
        : await datalayer.createDataLayerStore();

      loggerV2.verbose('[v2]: upgradeFromV1() is creating new V2 registryId store');
      const newV2RegistryStoreId = USE_SIMULATOR
        ? 'v2-registry-' + Date.now()
        : await datalayer.createDataLayerStore();

      loggerV2.verbose('[v2]: upgradeFromV1() is creating new V2 file store');
      const newV2FileStoreId = USE_SIMULATOR
        ? 'v2-filestore-' + Date.now()
        : await datalayer.createDataLayerStore();

      // CRITICAL: Use existing dataModelVersionStoreId singleton (do NOT create new one)
      const sharedDataModelVersionStoreId = v1DataModelVersionStoreId;

      const revertUpgradeIfFailed = async () => {
        loggerV2.error(
          '[v2]: upgrade from V1 to V2 organization process failed. removing failed V2 organization records. please try again',
        );
        await OrganizationsV2.destroy({ where: { org_uid: newV2OrgUid } });
        await OrganizationsV2.destroy({ where: { org_uid: 'PENDING' } });
      };

      if (!USE_SIMULATOR) {
        loggerV2.info(
          '[v2]: upgrade from V1 to V2 organization process is waiting for all store creations to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      loggerV2.verbose(
        `[v2]: the blockchain reported new V2 organization stores orgUid: ${newV2OrgUid}, ` +
          `registryId: ${newV2RegistryStoreId} have confirmed. `,
      );
      loggerV2.info(
        `[v2]: committing V2 organization data to orgUid store ${newV2OrgUid}`,
      );

      // Set up V2 orgUid store (completely new store)
      await datalayer.syncDataLayer(
        newV2OrgUid,
        {
          registryId: sharedDataModelVersionStoreId, // Points to SHARED singleton
          fileStoreId: newV2FileStoreId, // NEW file store (separate from V1)
          name,
          icon,
        },
        revertUpgradeIfFailed,
      );

      if (!USE_SIMULATOR) {
        loggerV2.info(
          '[v2]: upgrade from V1 to V2 organization process is waiting for organization data committed to orgUid store to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      loggerV2.info(
        `[v2]: updating shared data model version store ${sharedDataModelVersionStoreId} to add v2 key`,
      );

      // CRITICAL: Add v2 key to existing singleton (preserve v1 key)
      const updatedSingleton = {
        ...decodedSingleton, // Preserve existing keys (v1)
        v2: newV2RegistryStoreId, // Add v2 key
      };

      await datalayer.syncDataLayer(
        sharedDataModelVersionStoreId,
        updatedSingleton,
        revertUpgradeIfFailed,
      );

      if (!USE_SIMULATOR) {
        loggerV2.info(
          '[v2]: upgrade from V1 to V2 organization process is waiting for data model version update to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      loggerV2.info('[v2]: adding new V2 home organization to CADT database');
      await OrganizationsV2.create({
        org_uid: newV2OrgUid,
        data_model_version_store_id: sharedDataModelVersionStoreId, // SAME as V1 - shared singleton
        registry_id: newV2RegistryStoreId, // NEW registry store
        is_home: true,
        subscribed: USE_SIMULATOR,
        file_store_subscribed: newV2FileStoreId, // NEW file store
        name,
        icon,
      });

      const onConfirm = () => {
        loggerV2.info('[v2]: V2 Organization upgrade confirmed, you are ready to go');
        OrganizationsV2.update(
          {
            subscribed: true,
          },
          { where: { org_uid: newV2OrgUid } },
        );
      };

      if (!USE_SIMULATOR) {
        loggerV2.info('[v2]: Waiting for V2 Organization upgrade to be confirmed');
        await getStoreDataPromise(
          newV2OrgUid,
          onConfirm,
          revertUpgradeIfFailed,
        );
      } else {
        onConfirm();
      }

      return newV2OrgUid;
    } catch (error) {
      loggerV2.error(
        `[v2]: upgrade from V1 to V2 organization process failed. removing failed V2 organization records. please try again. Error: ${error.message}`,
      );
      await OrganizationsV2.destroy({ where: { is_home: true } });
      throw error;
    }
  }

  /**
   * Get V2 home organization
   * @param {boolean} includeAddress - Whether to include XCH address and file store subscription status
   * @returns {Promise<Object|null>} Home organization record or null if not found
   */
  static async getHomeOrg(includeAddress = true) {
    const myOrganization = await OrganizationsV2.findOne({
      where: { is_home: true },
      raw: true,
    });

    if (!myOrganization) {
      return null;
    }

    // Parse metadata JSON if exists
    if (myOrganization.metadata) {
      try {
        const parsedMetadata = JSON.parse(myOrganization.metadata);

        // Add each key from parsedMetadata to myOrganization
        for (const key in parsedMetadata) {
          if (Object.prototype.hasOwnProperty.call(parsedMetadata, key)) {
            myOrganization[key] = parsedMetadata[key];
          }
        }

        // Delete the original metadata property
        delete myOrganization.metadata;
      } catch (error) {
        loggerV2.warn('[v2]: Failed to parse organization metadata', { error: error.message });
      }
    }

    if (includeAddress) {
      myOrganization.xchAddress = await datalayer.getPublicAddress();
      myOrganization.fileStoreSubscribed = myOrganization.file_store_subscribed || false;
      return myOrganization;
    }

    // If not including address, check sync status based on pending commits
    const pendingCommitsCount = await StagingV2.count({
      where: { committed: true },
    });

    myOrganization.synced =
      myOrganization.synced === true && pendingCommitsCount === 0;

    return myOrganization;
  }

  /**
   * Get all organizations as a map/dictionary
   * @returns {Promise<Object>} Map of orgUid -> org data
   */
  static async getOrgsMap() {
    loggerV2.silly(
      '[v2]: [MIRROR_DEBUG] Starting getOrgsMap() - querying V2 organizations from database',
    );

    const organizations = await OrganizationsV2.findAll({
      attributes: [
        'org_uid',
        'org_hash',
        'name',
        'icon',
        'is_home',
        'subscribed',
        'synced',
        'file_store_subscribed',
        'registry_id',
        'registry_hash',
        'sync_remaining',
        'data_model_version_store_id',
        'data_model_version_store_hash',
      ],
    });

    loggerV2.silly(
      `[v2]: [MIRROR_DEBUG] Found ${organizations.length} V2 organizations in database`,
    );

    // Add XCH address and balance for home org
    for (let i = 0; i < organizations.length; i++) {
      if (organizations[i].dataValues.is_home) {
        organizations[i].dataValues.xchAddress =
          await datalayer.getPublicAddress();
        organizations[i].dataValues.balance =
          await datalayer.getWalletBalance();

        const pendingCommitsCount = await StagingV2.count({
          where: { committed: true },
        });

        organizations[i].dataValues.synced =
          organizations[i].dataValues.synced === true &&
          pendingCommitsCount === 0;
        break;
      }
    }

    const orgsMap = organizations.reduce((map, current) => {
      map[current.org_uid] = current.dataValues;
      loggerV2.silly(
        `[v2]: [MIRROR_DEBUG] Added to map - org_uid: ${current.org_uid}, name: ${current.dataValues.name}, subscribed: ${current.dataValues.subscribed}`,
      );
      return map;
    }, {});

    loggerV2.silly(
      `[v2]: [MIRROR_DEBUG] Returning V2 organizations map with ${Object.keys(orgsMap).length} entries`,
    );
    return orgsMap;
  }

  /**
   * Helper to upsert data to datalayer for V2 organizations
   * Reads current store data to check for existing keys
   * @param {string} storeId - Store ID to update
   * @param {Object} data - Data to upsert
   * @returns {Promise<void>}
   */
  static async upsertDataLayerV2(storeId, data) {
    loggerV2.info(`[v2]: Syncing ${storeId} (V2)`);

    // Get current store data to check for existing keys
    let currentData = {};
    try {
      if (USE_SIMULATOR) {
        const { getStoreData } = await import('../../datalayer/simulator.js');
        const encodedData = await getStoreData(storeId);
        if (encodedData?.keys_values) {
          const { decodeDataLayerResponse } = await import('../../utils/datalayer-utils.js');
          const decodedData = decodeDataLayerResponse(encodedData);
          currentData = decodedData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});
        }
      } else {
        const { getSubscribedStoreData } = await import('../../datalayer/syncService.js');
        currentData = await getSubscribedStoreData(storeId, undefined, false);
      }
    } catch (error) {
      // Store might not exist yet or have no data - that's okay
      loggerV2.debug(`[v2]: No existing data found for store ${storeId}, proceeding with insert only`);
      currentData = {};
    }

    // Build changelist - delete existing keys, then insert new values
    const { encodeHex } = await import('../../utils/datalayer-utils.js');
    const changeList = [];

    Object.keys(data).forEach((key) => {
      // If key exists, delete it first
      if (currentData[key]) {
        changeList.push({
          action: 'delete',
          key: encodeHex(key),
        });
      }
      // Then insert new value
      changeList.push({
        action: 'insert',
        key: encodeHex(key),
        value: encodeHex(data[key]),
      });
    });

    // Push changes to datalayer
    const { pushChangesWhenStoreIsAvailable } = await import('../../datalayer/writeService.js');
    await pushChangesWhenStoreIsAvailable(storeId, changeList);
  }

  /**
   * Edit home organization metadata (name and/or icon)
   * @param {Object} options - Object with name and/or icon
   * @param {string} [options.name] - New organization name
   * @param {string} [options.icon] - New organization icon (base64 string)
   * @returns {Promise<void>}
   */
  static async editOrgMeta({ name, icon }) {
    const myOrganization = await OrganizationsV2.getHomeOrg();

    if (!myOrganization) {
      throw new Error('Home organization not found');
    }

    const payload = {};

    if (name !== undefined) {
      payload.name = name;
    }

    if (icon !== undefined) {
      payload.icon = icon;
    }

    // Update datalayer using V2-specific method
    await OrganizationsV2.upsertDataLayerV2(myOrganization.org_uid, payload);

    // Update database record
    const updateData = {};
    if (name !== undefined) {
      updateData.name = name;
    }
    if (icon !== undefined) {
      updateData.icon = icon;
    }

    if (Object.keys(updateData).length > 0) {
      await OrganizationsV2.update(updateData, {
        where: { org_uid: myOrganization.org_uid },
      });
    }
  }

  /**
   * Add metadata to home organization
   * @param {Object} payload - Metadata key-value pairs to add
   * @returns {Promise<void>}
   */
  static async addMetadata(payload) {
    const myOrganization = await OrganizationsV2.getHomeOrg();

    if (!myOrganization) {
      throw new Error('Home organization not found');
    }

    // Get raw organization record to access metadata field (getHomeOrg deletes it after parsing)
    const rawOrg = await OrganizationsV2.findOne({
      where: { org_uid: myOrganization.org_uid },
      raw: true,
    });

    // Prefix keys with "meta_" for datalayer
    const metadata = _.mapKeys(payload, (_value, key) => `meta_${key}`);

    // Update datalayer using V2-specific method
    await OrganizationsV2.upsertDataLayerV2(myOrganization.org_uid, metadata);

    // Update database record - merge with existing metadata
    let existingMetadata = {};
    if (rawOrg?.metadata) {
      try {
        existingMetadata = JSON.parse(rawOrg.metadata);
      } catch (error) {
        loggerV2.warn('[v2]: Failed to parse existing metadata, starting fresh', {
          error: error.message,
        });
        existingMetadata = {};
      }
    }

    // Merge new metadata with existing
    const mergedMetadata = { ...existingMetadata, ...payload };

    // Update database with merged metadata as JSON string
    await OrganizationsV2.update(
      { metadata: JSON.stringify(mergedMetadata) },
      {
        where: { org_uid: myOrganization.org_uid },
      },
    );
  }

  /**
   * Helper to get registry store ID from singleton
   * For V2 system: Only returns v2 registry store ID (v1 fallback removed - pure V1 orgs stay in V1)
   * For upgraded orgs: Returns v2 registry store ID (they have both v1 and v2, but we use v2)
   * @param {string} dataModelVersionStoreId - The singleton store ID
   * @param {string} requiredVersion - Required version ('v2' for V2 system)
   * @returns {Promise<string>} Registry store ID
   * @throws {Error} If v2 registry store ID not found
   */
  static async getRegistryStoreIdFromSingleton(dataModelVersionStoreId, requiredVersion = 'v2') {
    loggerV2.debug(`[v2]: Getting registry store ID from singleton ${dataModelVersionStoreId}, required version: ${requiredVersion}`);

    // Get singleton data - use getStoreDataPromise in simulator mode, getSubscribedStoreData otherwise
    let singletonData = null;

    if (USE_SIMULATOR) {
      // In simulator mode, use getStoreDataPromise directly (no subscription needed)
      const storeData = await getStoreDataPromise(dataModelVersionStoreId);
      if (storeData && storeData.keys_values) {
        const decodedData = decodeDataLayerResponse(storeData);
        singletonData = decodedData.reduce((obj, current) => {
          obj[current.key] = current.value;
          return obj;
        }, {});
      } else {
        throw new Error(`Failed to get singleton data from ${dataModelVersionStoreId} in simulator mode`);
      }
    } else {
      // In production mode, use getSubscribedStoreData with timeout
      const timeout = Date.now() + 600000; // 10 minutes

      while (!singletonData) {
        try {
          singletonData = await datalayer.getSubscribedStoreData(
            dataModelVersionStoreId,
            undefined,
            true, // wait for sync
          );
          break;
        } catch (error) {
          if (Date.now() > timeout) {
            throw new Error(
              `Timeout getting singleton data from ${dataModelVersionStoreId}: ${error.message}`,
            );
          }
          loggerV2.debug(`[v2]: ${error.message}. RETRYING`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }
    }

    // V2 system requires v2 - no fallback to v1
    // Pure V1 organizations should use V1 API, not V2
    if (singletonData[requiredVersion]) {
      loggerV2.debug(`[v2]: Found registry store ID for version ${requiredVersion}: ${singletonData[requiredVersion]}`);
      return singletonData[requiredVersion];
    }

    throw new Error(
      `Failed to get ${requiredVersion} registry store ID from singleton ${dataModelVersionStoreId}. Available keys: ${Object.keys(singletonData).join(', ')}. Pure V1 organizations should use the V1 API.`,
    );
  }

  /**
   * Subscribe to organization stores (orgUid, registry, file store)
   * V2 system: Only subscribes to organizations with v2 data (no v1 fallback)
   * @param {string} orgUid - Organization UID
   * @returns {Promise<{orgUid: string, dataModelVersionStoreId: string, registryStoreId: string}>}
   */
  static async subscribeToOrganization(orgUid) {
    if (orgUid === 'PENDING') {
      loggerV2.info('[v2]: cannot subscribe to a home organization while its pending.');
      throw new Error('Cannot subscribe to PENDING organization');
    }

    loggerV2.debug(`[v2]: Running the organization subscription process on organization ${orgUid}`);

    // Timeout: 10 minutes
    const timeout = Date.now() + 600000;
    const reachedTimeout = () => Date.now() > timeout;
    const onTimeout = (error) => {
      const message = `Reached timeout before subscribing to all required stores. Failure at timeout: ${error.message}`;
      loggerV2.error(`[v2]: ${message}`);
      throw new Error(message);
    };

    // Step 1: Get org store data to find dataModelVersionStoreId
    loggerV2.debug(`[v2]: Determining datamodel version singleton id for org ${orgUid}`);
    let orgStoreData = null;

    if (USE_SIMULATOR) {
      // In simulator mode, use getStoreDataPromise directly
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
      // In production mode, use getSubscribedStoreData with retry logic
      while (!orgStoreData) {
        try {
          orgStoreData = await datalayer.getSubscribedStoreData(
            orgUid,
            undefined,
            true, // wait for sync
          );
          break;
        } catch (error) {
          if (reachedTimeout()) {
            onTimeout(error);
          }
          loggerV2.debug(`[v2]: ${error.message}. RETRYING`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      }
    }

    const dataModelVersionStoreId = orgStoreData.registryId;
    if (!dataModelVersionStoreId) {
      throw new Error(
        `Failed to get registry datamodel version singleton id from orgUid store ${orgUid}. RPC function returned: ${orgStoreData}`,
      );
    }
    loggerV2.debug(
      `[v2]: The registry datamodel version pointer singleton id for organization ${orgUid} is ${dataModelVersionStoreId}`,
    );

    // Step 2: Get registry store ID from singleton (must be v2 - V2 system only)
    loggerV2.debug(`[v2]: Determining registry store singleton id for org ${orgUid}`);
    const registryStoreId = await OrganizationsV2.getRegistryStoreIdFromSingleton(
      dataModelVersionStoreId,
      'v2', // Must be v2 - V2 system only works with V2 organizations
    );
    loggerV2.debug(
      `[v2]: The registry singleton id for organization ${orgUid} is ${registryStoreId}`,
    );

    // Step 3: Subscribe to registry store
    loggerV2.debug(`[v2]: Checking registry store singleton for org ${orgUid}`);
    const subscribedToRegistryStore =
      await datalayer.subscribeToStoreOnDataLayer(registryStoreId);
    // In simulator mode, subscribeToStoreOnDataLayer returns undefined (no-op)
    // In production mode, it returns true/false
    if (!USE_SIMULATOR && !subscribedToRegistryStore) {
      throw new Error(
        `Failed to subscribe to or validate subscription for registry store ${registryStoreId}`,
      );
    }

    // Step 4: Subscribe to file store if enabled
    if (AUTO_SUBSCRIBE_FILESTORE) {
      loggerV2.info(`[v2]: Subscribing to file store for organization ${orgUid}`);
      try {
        await FileStore.subscribeToFileStore(orgUid);
      } catch (error) {
        loggerV2.warn(
          `[v2]: Failed to subscribe to file store. Error: ${error.message}`,
        );
      }
    }

    // Step 5: Mark organization as subscribed in database if it exists
    const organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });
    if (organization) {
      loggerV2.info(`[v2]: Marking existing organization record as subscribed`);
      await OrganizationsV2.update(
        { subscribed: true },
        { where: { org_uid: orgUid } },
      );
    }

    return {
      orgUid,
      dataModelVersionStoreId,
      registryStoreId,
    };
  }

  /**
   * Import organization from datalayer
   * @param {string} orgUid - Organization UID
   * @param {boolean} isHome - Whether this is a home organization
   * @returns {Promise<void>}
   */
  static async importOrganization(orgUid, isHome = false) {
    loggerV2.verbose('[v2]: Acquiring mutex to import organization');
    const releaseMutex = await addOrDeleteOrganizationRecordMutex.acquire();

    try {
      // Validate store ownership if home org (skip in simulator mode)
      if (isHome && !USE_SIMULATOR) {
        try {
          await assertStoreIsOwned(orgUid);
        } catch {
          throw new Error(
            `orgUid store ${orgUid} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
          );
        }
      }

      // Remove from deleted orgs list if present
      const { MetaV2 } = await import('./index.js');
      await MetaV2.destroy({
        where: { meta_key: 'userDeletedOrgUid', meta_value: orgUid },
      });

      loggerV2.info(`[v2]: Importing organization ${orgUid} ${isHome && 'as home'}`);
      loggerV2.debug(
        `[v2]: Running the organization model subscription process on ${orgUid}`,
      );

      // Subscribe to organization stores
      let storeIds = null;
      try {
        storeIds = await OrganizationsV2.subscribeToOrganization(orgUid);
      } catch (error) {
        loggerV2.error(
          `[v2]: Failure validating or adding subscriptions for org import. cannot import. Error: ${error.message}`,
        );
        throw new Error(
          `Failed to subscribe to, or validate subscribed store data for, organization ${orgUid}`,
        );
      }

      // Validate store ownership for home org (skip in simulator mode)
      if (isHome && !USE_SIMULATOR) {
        try {
          await assertStoreIsOwned(storeIds.dataModelVersionStoreId);
        } catch {
          throw new Error(
            `datamodel version store ${storeIds.dataModelVersionStoreId} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
          );
        }

        try {
          await assertStoreIsOwned(storeIds.registryStoreId);
        } catch {
          throw new Error(
            `registry store ${storeIds.registryStoreId} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
          );
        }
      }

      // Get organization data from datalayer
      let orgData;
      let dataModelInfo;

      if (USE_SIMULATOR) {
        // In simulator mode, use getStoreDataPromise directly
        const orgStoreData = await getStoreDataPromise(storeIds.orgUid);
        if (orgStoreData && orgStoreData.keys_values) {
          const decodedOrgData = decodeDataLayerResponse(orgStoreData);
          orgData = decodedOrgData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});
        } else {
          throw new Error(`Failed to get organization data for ${orgUid} in simulator mode`);
        }

        // Get singleton data
        const singletonStoreData = await getStoreDataPromise(storeIds.dataModelVersionStoreId);
        if (singletonStoreData && singletonStoreData.keys_values) {
          const decodedSingletonData = decodeDataLayerResponse(singletonStoreData);
          dataModelInfo = decodedSingletonData.reduce((obj, current) => {
            obj[current.key] = current.value;
            return obj;
          }, {});
        } else {
          throw new Error(
            `Failed to determine datamodel version for organization ${orgUid} in simulator mode`,
          );
        }
      } else {
        // In production mode, use getCurrentStoreData
        orgData = await datalayer.getCurrentStoreData(storeIds.orgUid);
        if (!orgData) {
          throw new Error(`Failed to get organization data for ${orgUid}`);
        }

        dataModelInfo = await datalayer.getCurrentStoreData(
          storeIds.dataModelVersionStoreId,
        );
        if (!dataModelInfo) {
          throw new Error(
            `Failed to determine datamodel version for organization ${orgUid}`,
          );
        }
      }

      // CRITICAL: V2 can only import organizations that have v2 data
      // Pure V1 organizations (singleton only has v1) should stay in V1 system
      // Only upgraded organizations (singleton has both v1 and v2) can be imported
      if (!dataModelInfo.v2) {
        throw new Error(
          `Organization ${orgUid} does not have V2 data. Only V2 organizations (or upgraded organizations with V2 data) can be imported into V2 system. Pure V1 organizations should use the V1 API.`,
        );
      }

      // Get registry store ID (must use v2 - this is a V2 system)
      const registryStoreId = await OrganizationsV2.getRegistryStoreIdFromSingleton(
        storeIds.dataModelVersionStoreId,
        'v2', // Must be v2 for V2 system
      );

      // Create organization record
      const organizationData = {
        org_uid: orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registry_id: registryStoreId,
        data_model_version_store_id: storeIds.dataModelVersionStoreId,
        file_store_subscribed: orgData?.fileStoreId || null,
        subscribed: true,
        is_home: isHome,
      };
      loggerV2.info(
        `[v2]: Adding organization with the following info: ${JSON.stringify(organizationData)}`,
      );

      await OrganizationsV2.create(organizationData);
    } catch (error) {
      throw new Error(error.message);
    } finally {
      releaseMutex();
    }
  }

  /**
   * Unsubscribe from organization stores
   * @param {Object} organization - Organization record
   * @param {string} organization.org_uid - Organization UID
   * @param {string} organization.data_model_version_store_id - Data model version store ID
   * @param {string} organization.registry_id - Registry store ID
   * @returns {Promise<void>}
   */
  static async unsubscribeFromOrganizationStores(organization) {
    const { storeIds: subscriptionIds, success } = await getSubscriptions();
    if (!success) {
      throw new Error('Failed to get subscriptions from datalayer');
    }

    const storesToUnsubscribe = [
      organization.org_uid,
      organization.data_model_version_store_id,
      organization.registry_id,
    ];
    const failedUnsubscribes = [];

    storesToUnsubscribe.forEach((storeId) => {
      if (!storeId) {
        const message = `Organization stores cannot be nil. found nil store id associated with organization ${organization.org_uid}`;
        loggerV2.error(`[v2]: ${message}`);
        throw new Error(message);
      }
    });

    for (const storeId of storesToUnsubscribe) {
      if (subscriptionIds.includes(storeId)) {
        try {
          await datalayer.unsubscribeFromDataLayerStoreWithRetry(storeId);
          loggerV2.info(`[v2]: Successfully unsubscribed from store ${storeId}`);
        } catch (error) {
          loggerV2.error(
            `[v2]: unsubscribeFromOrganizationStores() encountered an error: ${error.message}`,
          );
          failedUnsubscribes.push(storeId);
        }
      }
    }

    if (failedUnsubscribes.length) {
      const message = `Failed to unsubscribe from the following organization stores: ${failedUnsubscribes.join(', ')}`;
      loggerV2.error(`[v2]: ${message}`);
      throw new Error(message);
    }

    // Mark organization as unsubscribed in database
    const orgExistsInDb = await OrganizationsV2.findOne({
      where: { org_uid: organization.org_uid },
      raw: true,
    });

    if (orgExistsInDb) {
      await OrganizationsV2.update(
        { subscribed: false },
        { where: { org_uid: organization.org_uid } },
      );
    }
  }

  /**
   * Reconcile organization - validate and update database with datalayer data
   * @param {Object} organization - Organization record
   * @returns {Promise<void>}
   */
  static async reconcileOrganization(organization) {
    const { org_uid, is_home } = organization;

    loggerV2.info(`[v2]: Reconciling organization ${org_uid}`);

    // Validate store ownership if home org (skip in simulator mode)
    if (is_home && !USE_SIMULATOR) {
      try {
        await assertStoreIsOwned(org_uid);
      } catch {
        throw new Error(
          `orgUid store ${org_uid} is not owned by this chia wallet. cannot reconcile home organization`,
        );
      }
    }

    // Subscribe to organization (this will update subscriptions if needed)
    const storeIds = await OrganizationsV2.subscribeToOrganization(org_uid);

    // Get current data from datalayer
    let orgData;
    if (USE_SIMULATOR) {
      // In simulator mode, use getStoreDataPromise directly
      const storeData = await getStoreDataPromise(org_uid);
      if (storeData && storeData.keys_values) {
        const decodedData = decodeDataLayerResponse(storeData);
        orgData = decodedData.reduce((obj, current) => {
          obj[current.key] = current.value;
          return obj;
        }, {});
      } else {
        throw new Error(`Failed to get organization data for ${org_uid} in simulator mode`);
      }
    } else {
      // In production mode, use getCurrentStoreData
      orgData = await datalayer.getCurrentStoreData(org_uid);
      if (!orgData) {
        throw new Error(`Failed to get organization data for ${org_uid}`);
      }
    }

    // Get registry store ID from singleton (must be v2 - V2 system only)
    const registryStoreId = await OrganizationsV2.getRegistryStoreIdFromSingleton(
      storeIds.dataModelVersionStoreId,
      'v2', // Must be v2 - V2 system only works with V2 organizations
    );

    // Compare datalayer data with database
    const updates = {};
    let needsUpdate = false;

    if (organization.name !== orgData.name) {
      updates.name = orgData.name;
      needsUpdate = true;
    }

    if (organization.icon !== orgData.icon) {
      updates.icon = orgData.icon;
      needsUpdate = true;
    }

    if (organization.registry_id !== registryStoreId) {
      updates.registry_id = registryStoreId;
      needsUpdate = true;
    }

    if (organization.data_model_version_store_id !== storeIds.dataModelVersionStoreId) {
      updates.data_model_version_store_id = storeIds.dataModelVersionStoreId;
      needsUpdate = true;
    }

    if (organization.file_store_subscribed !== (orgData?.fileStoreId || null)) {
      updates.file_store_subscribed = orgData?.fileStoreId || null;
      needsUpdate = true;
    }

    // Update database if discrepancies found
    if (needsUpdate) {
      loggerV2.info(`[v2]: Updating organization ${org_uid} with datalayer data`);
      await OrganizationsV2.update(updates, {
        where: { org_uid },
      });
    } else {
      loggerV2.debug(`[v2]: Organization ${org_uid} is in sync with datalayer`);
    }
  }

  /**
   * Delete all V2 data for an organization
   * @param {string} orgUid - Organization UID
   * @returns {Promise<void>}
   */
  static async deleteAllOrganizationData(orgUid, retryCount = 0) {
    const maxRetries = 10;
    const baseDelay = 200; // 200ms base delay
    const maxDelay = 5000; // 5 seconds max delay

    loggerV2.verbose('[v2]: acquiring add/delete org mutex to delete organization');
    const releaseAddDeleteMutex =
      await addOrDeleteOrganizationRecordMutex.acquire();

    loggerV2.verbose(
      '[v2]: acquiring processingSyncRegistriesTransaction mutex to delete organization',
    );
    const releaseAuditTransactionMutex =
      await processingSyncRegistriesTransactionMutex.acquire();

    const transaction = await sequelizeV2.transaction();
    try {
      // Import V2 models
      const { MetaV2, AuditV2 } = await import('./index.js');

      // Delete from organization table
      await OrganizationsV2.destroy({
        where: { org_uid: orgUid },
        transaction,
      });

      // Note: StagingV2 doesn't have org_uid, so we can't delete org-specific staging records
      // Staging is temporary and will be cleared on next commit cycle
      // We skip truncating staging here to avoid database locks

      // Delete from audit table (only V2 data model with org_uid)
      await AuditV2.destroy({
        where: { org_uid: orgUid },
        transaction,
      });

      // Delete from meta table (org-related metadata)
      // Note: This delete might not match anything if the record doesn't exist
      // We delete it here to clean up, but the main logic below handles create/update
      await MetaV2.destroy({
        where: { meta_key: 'userDeletedOrgUid', meta_value: orgUid },
        transaction,
      });

      // Note: V2 data models (ProgramV2, ProjectV2, etc.) don't have org_uid fields
      // They are associated with organizations through the registry, not directly.
      // Data model records are shared across organizations that use the same registry.
      // Therefore, we only delete from system tables (AuditV2, StagingV2, MetaV2) and the organization itself.

      // Add to deleted orgs list (before commit so it's part of transaction)
      // Use upsert instead of findOne + create/update to avoid unique constraint lock issues
      // First, try to find existing record to get current value
      const existingMeta = await MetaV2.findOne({
        where: { meta_key: 'userDeletedOrgUid' },
        transaction,
      });

      let deletedOrgs = [];
      if (existingMeta) {
        // Parse existing value and add orgUid if not already present
        try {
          deletedOrgs = JSON.parse(existingMeta.meta_value || '[]');
        } catch {
          deletedOrgs = [];
        }
      }

      if (!deletedOrgs.includes(orgUid)) {
        deletedOrgs.push(orgUid);
        // Use upsert to handle both create and update cases atomically
        // This avoids unique constraint lock issues
        await MetaV2.upsert({
          meta_key: 'userDeletedOrgUid',
          meta_value: JSON.stringify(deletedOrgs),
        }, {
          transaction,
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();

      // Check if it's a database lock error and we haven't exceeded max retries
      // Check both error.message and error.original (Sequelize wraps errors)
      const errorMessage = error.message || '';
      const originalError = error.original || error.parent || {};
      const originalMessage = originalError.message || '';
      const errorCode = error.code || originalError.code || '';

      const isDatabaseLockError =
        errorMessage.includes('SQLITE_BUSY') ||
        errorMessage.includes('database is locked') ||
        originalMessage.includes('SQLITE_BUSY') ||
        originalMessage.includes('database is locked') ||
        errorCode === 'SQLITE_BUSY' ||
        originalError.code === 'SQLITE_BUSY';

      if (isDatabaseLockError && retryCount < maxRetries) {
        // Calculate exponential backoff delay
        const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
        loggerV2.info(
          `[v2]: Database lock detected for deleteAllOrganizationData (attempt ${retryCount + 1}/${maxRetries}). Retrying in ${delay}ms...`,
        );

        // Release mutexes before retry
        releaseAddDeleteMutex();
        releaseAuditTransactionMutex();

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Retry the operation
        return await OrganizationsV2.deleteAllOrganizationData(
          orgUid,
          retryCount + 1,
        );
      }

      // If not a lock error or max retries exceeded, throw the error
      loggerV2.error(
        `[v2]: failed to delete all db records for organization ${orgUid}, rolling back changes. Error: ${error.message}`,
      );
      releaseAddDeleteMutex();
      releaseAuditTransactionMutex();
      throw new Error(
        `an error occurred while deleting records corresponding to organization ${orgUid}. no changes have been made`,
      );
    }
    // Success case - release mutexes
    releaseAddDeleteMutex();
    releaseAuditTransactionMutex();
  }

  /**
   * Synchronizes metadata for all subscribed organizations
   * @returns {Promise<void>}
   */
  static async syncOrganizationMeta() {
    try {
      const allSubscribedOrganizations = await OrganizationsV2.findAll({
        where: { subscribed: true },
        raw: true,
      });

      for (const organization of allSubscribedOrganizations) {
        const processData = (data, keyFilter) =>
          data
            .filter(({ key }) => keyFilter(key))
            .reduce(
              (update, { key, value }) => ({ ...update, [key]: value }),
              {},
            );

        const onFail = async (message) => {
          loggerV2.info(`[v2]: Unable to sync metadata from ${organization.org_uid}`);
          loggerV2.error(`[v2]: ORGANIZATION DATA SYNC ERROR: ${message}`);
          await OrganizationsV2.update(
            { org_hash: '0' },
            { where: { org_uid: organization.org_uid } },
          );
        };

        const onResult = async (updateHash, data) => {
          try {
            const updateData = processData(
              data,
              (key) => !key.includes('meta_'),
            );
            const metadata = processData(data, (key) => key.includes('meta_'));

            // Convert metadata object to JSON string
            const metadataJson = Object.keys(metadata).length > 0
              ? JSON.stringify(metadata)
              : '{}';

            await OrganizationsV2.update(
              {
                ..._.omit(updateData, [
                  'registry_id',
                  'data_model_version_store_id',
                ]),
                metadata: metadataJson,
              },
              { where: { org_uid: organization.org_uid } },
            );

            loggerV2.debug(
              `[v2]: Updating orgUid ${organization.org_uid} with hash ${updateHash}`,
            );
            await OrganizationsV2.update(
              { org_hash: updateHash },
              { where: { org_uid: organization.org_uid } },
            );
          } catch (error) {
            loggerV2.info(`[v2]: ${error.message}`);
            onFail(error.message);
          }
        };

        // Use datalayer.getStoreIfUpdated (from syncService)
        await datalayer.getStoreIfUpdated(
          organization.org_uid,
          organization.org_hash || '0',
          onResult,
          onFail,
        );
      }
    } catch (error) {
      loggerV2.error(`[v2]: Error in syncOrganizationMeta: ${error.message}`);
    }
  }

  /**
   * Add mirror for a store
   * @param {string} storeId - Store ID
   * @param {string} url - Mirror URL
   * @param {boolean} force - Force add mirror even without home org
   * @returns {Promise<boolean>} Success status
   */
  static async addMirror(storeId, url, force = false) {
    return await datalayer.addMirror(storeId, url, force);
  }

  /**
   * Remove mirror for a store
   * @param {string} storeId - Store ID
   * @param {string} coinId - Coin ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeMirror(storeId, coinId) {
    return await datalayer.removeMirror(storeId, coinId);
  }
}

OrganizationsV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'OrganizationsV2',
  tableName: 'organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
});

export default OrganizationsV2;
