'use strict';

/*
  We use the SHA256 hash as the unique file ID,
  this prevents duplicate files from being uploaded to the same store.
*/

import { Model } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import OrganizationsV2 from './organizations-v2.model.js';

import datalayer from '../../datalayer';
import pendingFileStoreCreations from '../../datalayer/pending-file-store-creations.js';
import { encodeHex } from '../../utils/datalayer-utils.js';
import { loggerV2 } from '../../config/logger.js';
import { getConfig } from '../../utils/config-loader.js';

const { USE_SIMULATOR } = getConfig().APP;

// Helper to get store data - uses simulator in simulator mode, otherwise wraps callback-based version
const getStoreDataPromise = async (storeId) => {
  if (USE_SIMULATOR) {
    const simulatorModule = await import('../../datalayer/simulator.js');
    const simulator = simulatorModule.default || simulatorModule;
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

import ModelTypes from './filestore-v2.modeltypes.js';

/**
 * Find a file store id already persisted for this org, checking this model's
 * table first and then the v1 model's. An upgraded org keeps the same file
 * store on both sides (see OrganizationsV2.upgradeFromV1), so an id recorded
 * by either model means the store already exists and must not be re-minted.
 * @param {string} orgUid
 * @returns {Promise<string|null>}
 */
const findExistingFileStoreId = async (orgUid) => {
  const organization = await OrganizationsV2.findOne({
    where: { org_uid: orgUid },
    attributes: ['file_store_subscribed'],
    raw: true,
  });
  if (organization?.file_store_subscribed) {
    return organization.file_store_subscribed;
  }

  try {
    const { Organization } = await import(
      '../organizations/organizations.model.js'
    );
    const v1Organization = await Organization.findOne({
      where: { orgUid },
      attributes: ['fileStoreId'],
      raw: true,
    });
    return v1Organization?.fileStoreId || null;
  } catch {
    // v1 tables may not be populated in a v2-only deployment.
    return null;
  }
};

/**
 * Start file store creation for an org unless one is already running.
 * Returns immediately; callers are expected to throw a retry-later error.
 * @param {Object} myOrganization - Home organization row
 */
const startFileStoreCreation = (myOrganization) => {
  const orgUid = myOrganization.org_uid;

  if (pendingFileStoreCreations.has(orgUid)) {
    return;
  }

  pendingFileStoreCreations.add(orgUid);

  const mintAndPersist = async () => {
    // The caller's org snapshot may predate a creation that has since
    // finished, and the v1 model may have recorded the store for an
    // upgraded org; adopt any persisted id instead of minting another.
    const existingId = await findExistingFileStoreId(orgUid);
    if (existingId) {
      await OrganizationsV2.update(
        { file_store_subscribed: existingId },
        { where: { org_uid: orgUid } },
      );
      return null;
    }

    await datalayer.waitForSpendableCoins(1);
    const newFileStoreId = await datalayer.createDataLayerStoreWithRetry();
    // Record the store before syncing. The store is already paid for on
    // chain, so losing the id to a sync failure would mint another one on
    // the next request; subsequent requests use the persisted id.
    await OrganizationsV2.update(
      { file_store_subscribed: newFileStoreId },
      { where: { org_uid: orgUid } },
    );
    return newFileStoreId;
  };

  const run = async () => {
    let newFileStoreId = null;
    try {
      newFileStoreId = await mintAndPersist();
    } catch (error) {
      loggerV2.error(
        `[v2]: Failed to create file store for org ${orgUid}: ${error.message}`,
      );
    } finally {
      // Released before the org-store push, which retries for up to half an
      // hour. The guard only has to cover the mint, and the id is persisted by
      // this point, so anything arriving later adopts it rather than minting.
      // Holding it across the push would keep the v1 model from adopting the
      // id for an upgraded org for that whole window.
      pendingFileStoreCreations.delete(orgUid);
    }

    if (!newFileStoreId) {
      return;
    }

    try {
      await datalayer.syncDataLayer(orgUid, { fileStoreId: newFileStoreId });
    } catch (error) {
      // The store id is persisted and usable by subsequent requests; only
      // the org-store metadata push failed.
      loggerV2.error(
        `[v2]: File store ${newFileStoreId} for org ${orgUid} was created and recorded, ` +
          `but registering it on the org store failed: ${error.message}`,
      );
    }
  };

  run().catch((error) => {
    loggerV2.error(
      `[v2]: File store creation for org ${orgUid} failed unexpectedly: ${error?.message}`,
    );
  });
};

class FilestoreV2 extends Model {
  static async create(values, options) {
    const result = await super.create(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async bulkCreate(values, options) {
    const result = await super.bulkCreate(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async update(values, options) {
    const result = await super.update(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async upsert(values, options) {
    const result = await super.upsert(values, options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  static async destroy(options) {
    const result = await super.destroy(options);
    if (process.env.USE_SIMULATOR !== 'true') await new Promise((resolve) => setTimeout(resolve, 50));
    return result;
  }

  /**
   * Subscribe to a file store for an organization
   * @param {string} orgUid - Organization UID
   * @throws {Error} If organization doesn't exist or doesn't have a file store
   */
  static async subscribeToFileStore(orgUid) {
    const organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });

    if (!organization) {
      throw new Error(`Org ${orgUid} does not exist`);
    }

    const fileStoreId = organization.file_store_subscribed;

    if (!fileStoreId) {
      throw new Error(
        `Org ${orgUid} does not have a file store to subscribe to`,
      );
    }

    await datalayer.subscribeToStoreOnDataLayer(fileStoreId);
  }

  /**
   * Unsubscribe from a file store for an organization
   * @param {string} orgUid - Organization UID
   * @throws {Error} If organization doesn't exist
   */
  static async unsubscribeFromFileStore(orgUid) {
    const organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      raw: true,
    });

    if (!organization) {
      throw new Error(
        `Org ${orgUid} does not have a file store to unsubscribe from.`,
      );
    }

    const fileStoreId = organization.file_store_subscribed;

    if (fileStoreId) {
      // Delete cached files for this organization
      await FilestoreV2.destroy({ where: { org_uid: orgUid } });
      // Unsubscribe from datalayer store
      await datalayer.unsubscribeFromDataLayerStore(fileStoreId);
      // Update organization file_store_subscribed status
      await OrganizationsV2.update(
        { file_store_subscribed: null },
        { where: { org_uid: orgUid } },
      );
    }
  }

  /**
   * Add a file to the file store
   * @param {string} SHA256 - SHA256 hash of the file (used as unique ID)
   * @param {string} fileName - Name of the file
   * @param {string} base64File - Base64 encoded file content
   * @throws {Error} If no home org exists or file already exists
   */
  static async addFileToFileStore(SHA256, fileName, base64File) {
    const myOrganization = await OrganizationsV2.getHomeOrg();

    if (!myOrganization) {
      throw new Error('No home org detected');
    }

    const fileStoreId = myOrganization.file_store_subscribed;

    if (myOrganization && !fileStoreId) {
      startFileStoreCreation(myOrganization);
      throw new Error('New File store being created, please try again later.');
    }

    // Check if file already exists
    const existingFile = await FilestoreV2.findOne({
      where: { sha256: SHA256 },
      attributes: ['sha256'],
    });

    if (existingFile) {
      throw new Error('File Already exists in the filestore');
    }

    // Add file to datalayer store
    await datalayer.syncDataLayer(fileStoreId, {
      [SHA256]: JSON.stringify({
        name: fileName,
        file: base64File,
      }),
    });

    // Cache file in database
    await FilestoreV2.upsert({
      sha256: SHA256,
      file_name: fileName,
      data: base64File,
      org_uid: myOrganization.org_uid,
    });
  }

  /**
   * Get list of all files in the file store
   * @returns {Promise<Array>} Array of file records with sha256, file_name, org_uid
   * @throws {Error} If file store is being created
   */
  static async getFileStoreList() {
    const myOrganization = await OrganizationsV2.getHomeOrg();

    if (!myOrganization) {
      throw new Error('No home org detected');
    }

    const fileStoreId = myOrganization.file_store_subscribed;

    if (!fileStoreId) {
      startFileStoreCreation(myOrganization);
      throw new Error('New File store being created, please try again later.');
    }

    // Sync files from datalayer to cache (non-blocking)
    if (fileStoreId) {
      getStoreDataPromise(fileStoreId)
        .then((fileStore) => {
          // Cache files in database (don't await - non-blocking)
          return Promise.all(
            Object.keys(fileStore).map((key) => {
              const fileData = fileStore[key];
              // Handle both stringified JSON and direct object formats
              let parsedData = fileData;
              if (typeof fileData === 'string') {
                try {
                  parsedData = JSON.parse(fileData);
                } catch {
                  parsedData = { name: key, file: fileData };
                }
              }

              return FilestoreV2.upsert({
                sha256: key,
                file_name: parsedData.name || parsedData.fileName || key,
                data: parsedData.file || parsedData.data || fileData,
                org_uid: myOrganization.org_uid,
              });
            }),
          );
        })
        .catch((error) => {
          loggerV2.warn('[v2]: Failed to sync file store data', { error: error.message });
        });
    }

    // Return cached files from database
    return FilestoreV2.findAll({
      attributes: ['sha256', 'file_name', 'org_uid'],
      raw: true,
    });
  }

  /**
   * Delete a file from the file store
   * @param {string} SHA256 - SHA256 hash of the file to delete
   * @throws {Error} If file store is being created
   */
  static async deleteFileStoreItem(SHA256) {
    const myOrganization = await OrganizationsV2.getHomeOrg();

    if (!myOrganization) {
      throw new Error('No home org detected');
    }

    const fileStoreId = myOrganization.file_store_subscribed;

    if (!fileStoreId) {
      startFileStoreCreation(myOrganization);
      throw new Error('New File store being created, please try again later.');
    }

    const changeList = [
      {
        action: 'delete',
        key: encodeHex(SHA256),
      },
    ];

    await Promise.all([
      datalayer.pushDataLayerChangeList(fileStoreId, changeList),
      FilestoreV2.destroy({
        where: { sha256: SHA256, org_uid: myOrganization.org_uid },
      }),
    ]);
  }

  /**
   * Get a file from the file store by SHA256 hash
   * @param {string} SHA256 - SHA256 hash of the file
   * @returns {Promise<string>} Base64 encoded file content
   * @throws {Error} If file store is being created or file not found
   */
  static async getFileStoreItem(SHA256) {
    const myOrganization = await OrganizationsV2.getHomeOrg();

    if (!myOrganization) {
      throw new Error('No home org detected');
    }

    const fileStoreId = myOrganization.file_store_subscribed;

    if (!fileStoreId) {
      startFileStoreCreation(myOrganization);
      throw new Error('New File store being created, please try again later.');
    }

    // Check cache first
    const cachedFile = await FilestoreV2.findOne({
      where: { sha256: SHA256 },
      raw: true,
    });

    if (cachedFile) {
      return cachedFile.data;
    }

    // Fetch from datalayer
    const fileStore = await getStoreDataPromise(fileStoreId);

    if (!fileStore || !fileStore[SHA256]) {
      throw new Error(`File with SHA256 ${SHA256} not found in file store`);
    }

    const fileData = fileStore[SHA256];
    let parsedData = fileData;

    // Handle both stringified JSON and direct object formats
    if (typeof fileData === 'string') {
      try {
        parsedData = JSON.parse(fileData);
      } catch {
        parsedData = { name: SHA256, file: fileData };
      }
    }

    const fileName = parsedData.name || parsedData.fileName || SHA256;
    const fileContent = parsedData.file || parsedData.data || fileData;

    // Cache file in database (don't await - non-blocking)
    FilestoreV2.upsert({
      sha256: SHA256,
      file_name: fileName,
      data: fileContent,
      org_uid: myOrganization.org_uid,
    }).catch((error) => {
      loggerV2.warn('[v2]: Failed to cache file', { error: error.message });
    });

    return fileContent;
  }
}

FilestoreV2.init(ModelTypes, {
  sequelize: sequelizeV2,
  modelName: 'fileStore',
  tableName: 'file_store',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export default FilestoreV2;

