import _ from 'lodash';
import * as dataLayer from '../datalayer/persistance';
import wallet from '../datalayer/wallet';
import * as simulator from '../datalayer/simulator';
import { encodeHex, getMirrorUrl } from '../utils/datalayer-utils';
import { getConfig } from '../utils/config-loader';
import { getV2Config } from '../utils/v2-config-loader';
import { logger } from '../config/logger.js';
import { OrganizationsV2 } from '../models/v2/index.js';

const { USE_SIMULATOR, AUTO_MIRROR_EXTERNAL_STORES } = getConfig().APP;

/**
 * V2-specific datalayer operations
 */
export class V2DatalayerService {
  /**
   * Create a V2-specific datalayer store
   */
  static async createV2DataLayerStore() {
    await wallet.waitForAllTransactionsToConfirm();

    let storeId;
    if (USE_SIMULATOR) {
      storeId = await simulator.createDataLayerStore();
    } else {
      storeId = await dataLayer.createDataLayerStore();

      logger.info(
        `Created V2 storeId: ${storeId}, waiting for this to be confirmed on the blockchain.`,
      );
      await this.waitForNewStoreToBeConfirmed(storeId);
      await wallet.waitForAllTransactionsToConfirm();

      // Default AUTO_MIRROR_EXTERNAL_STORES to true if it is null or undefined
      const shouldMirror = AUTO_MIRROR_EXTERNAL_STORES ?? true;

      if (shouldMirror) {
        const mirrorUrl = await getMirrorUrl();
        await dataLayer.addMirror(storeId, mirrorUrl, true);
      }
    }

    return storeId;
  }

  /**
   * Sync V2 data to datalayer store
   */
  static async syncV2DataLayer(storeId, data) {
    logger.info(`Syncing V2 data to ${storeId}`);
    const homeOrg = await OrganizationsV2.getHomeOrg();
    let changeList = Object.keys(data).map((key) => {
      const change = [];

      if (homeOrg[key]) {
        change.push({
          action: 'delete',
          key: encodeHex(key),
        });
      }

      change.push({
        action: 'insert',
        key: encodeHex(key),
        value: encodeHex(data[key]),
      });
      return change;
    });

    const finalChangeList = _.uniqBy(
      _.sortBy(_.flatten(_.values(changeList)), 'action'),
      (v) => [v.action, v.key].join(),
    );

    await this.pushChangesWhenStoreIsAvailable(storeId, finalChangeList);
  }

  /**
   * Upsert V2 data to datalayer store
   */
  static async upsertV2DataLayer(storeId, data) {
    logger.info(`Upserting V2 data to ${storeId}`);
    const homeOrg = await OrganizationsV2.getHomeOrg();
    let changeList = Object.keys(data).map((key) => {
      const change = [];

      if (homeOrg[key]) {
        change.push({
          action: 'delete',
          key: encodeHex(key),
        });
      }

      change.push({
        action: 'insert',
        key: encodeHex(key),
        value: encodeHex(data[key]),
      });
      return change;
    });

    const finalChangeList = _.uniqBy(
      _.sortBy(_.flatten(_.values(changeList)), 'action'),
      (v) => [v.action, v.key].join(),
    );

    await this.pushChangesWhenStoreIsAvailable(storeId, finalChangeList);
  }

  /**
   * Wait for new store to be confirmed on blockchain
   */
  static async waitForNewStoreToBeConfirmed(storeId) {
    const timeout = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const subscriptions = await dataLayer.getSubscriptions();
        if (subscriptions.success && subscriptions.storeIds.includes(storeId)) {
          logger.info(`Store ${storeId} confirmed on blockchain`);
          return;
        }
      } catch (error) {
        logger.debug(`Waiting for store ${storeId} confirmation: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }

    throw new Error(`Timeout waiting for store ${storeId} to be confirmed`);
  }

  /**
   * Push changes when store is available
   */
  static async pushChangesWhenStoreIsAvailable(storeId, changeList) {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await dataLayer.pushChangeListToDataLayer(storeId, changeList);
        logger.info(`Successfully pushed changes to V2 store ${storeId}`);
        return;
      } catch (error) {
        retryCount++;
        logger.warn(`Failed to push changes to V2 store ${storeId}, attempt ${retryCount}: ${error.message}`);

        if (retryCount >= maxRetries) {
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
      }
    }
  }

  /**
   * Create V2 organization stores (orgUid, dataModelVersion, v2Registry)
   */
  static async createV2OrganizationStores(orgName, orgIcon) {
    logger.info('Creating V2 organization stores');

    // Create organization store
    const orgStoreId = await this.createV2DataLayerStore();

    // Create V2 registry store
    const v2RegistryStoreId = await this.createV2DataLayerStore();

    // Create data model version store
    const dataModelVersionStoreId = await this.createV2DataLayerStore();

    // Create file store
    const fileStoreId = await this.createV2DataLayerStore();

    // Set up data model version store with V2 structure
    const dataModelVersionStoreData = {
      v1: v2RegistryStoreId, // For backward compatibility
      v2: v2RegistryStoreId, // V2-specific registry
    };

    await this.upsertV2DataLayer(dataModelVersionStoreId, dataModelVersionStoreData);

    // Set up organization store
    const orgStoreData = {
      name: orgName || 'My V2 Organization',
      icon: orgIcon || '',
      dataModelVersionStoreId,
      fileStoreId,
    };

    await this.upsertV2DataLayer(orgStoreId, orgStoreData);

    return {
      orgStoreId,
      v2RegistryStoreId,
      dataModelVersionStoreId,
      fileStoreId,
    };
  }

  /**
   * Subscribe to V2 organization stores
   */
  static async subscribeToV2OrganizationStores(orgUid) {
    const organization = await OrganizationsV2.findOne({
      where: { orgUid },
      raw: true,
    });

    if (!organization) {
      throw new Error(`V2 Organization ${orgUid} not found`);
    }

    const { dataModelVersionStoreId, v2RegistryId } = organization;

    if (!dataModelVersionStoreId || !v2RegistryId) {
      throw new Error(`V2 Organization ${orgUid} missing store IDs`);
    }

    // Subscribe to data model version store
    const subscribedToDataModelVersionStore =
      await dataLayer.subscribeToStoreOnDataLayer(dataModelVersionStoreId);
    if (!subscribedToDataModelVersionStore) {
      throw new Error(
        `Failed to subscribe to V2 dataModelVersionStore ${dataModelVersionStoreId}`,
      );
    }

    // Subscribe to V2 registry store
    const subscribedToV2RegistryStore =
      await dataLayer.subscribeToStoreOnDataLayer(v2RegistryId);
    if (!subscribedToV2RegistryStore) {
      throw new Error(
        `Failed to subscribe to V2 registry store ${v2RegistryId}`,
      );
    }

    logger.info(`Successfully subscribed to V2 organization stores for ${orgUid}`);
    return {
      dataModelVersionStoreId,
      v2RegistryId,
    };
  }
}



