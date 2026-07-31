'use strict';

/*
  We use the SHA256 hash as the unique file ID,
  this prevents duplicate files from being uploaded to the same store.
*/

import { Model } from 'sequelize';
import { sequelize } from '../../database';
import { Organization } from '../';

import datalayer from '../../datalayer';
import pendingFileStoreCreations from '../../datalayer/pending-file-store-creations.js';
import { encodeHex } from '../../utils/datalayer-utils';
import { logger } from '../../config/logger.js';

import ModelTypes from './file-store.modeltypes.js';

/**
 * Find a file store id already persisted for this org, checking this model's
 * table first and then the v2 model's. An upgraded org keeps the same file
 * store on both sides (see OrganizationsV2.upgradeFromV1), so an id recorded
 * by either model means the store already exists and must not be re-minted.
 * @param {string} orgUid
 * @returns {Promise<string|null>}
 */
const findExistingFileStoreId = async (orgUid) => {
  const organization = await Organization.findOne({
    where: { orgUid },
    attributes: ['fileStoreId'],
    raw: true,
  });
  if (organization?.fileStoreId) {
    return organization.fileStoreId;
  }

  try {
    // A static import of the v2 model from this v1 model would create a
    // circular module dependency, so resolve it lazily.
    // eslint-disable-next-line no-restricted-syntax
    const { default: OrganizationsV2 } = await import(
      '../v2/organizations-v2.model.js'
    );
    const v2Organization = await OrganizationsV2.findOne({
      where: { org_uid: orgUid },
      attributes: ['file_store_subscribed'],
      raw: true,
    });
    return v2Organization?.file_store_subscribed || null;
  } catch {
    // v2 tables may not exist in a v1-only deployment.
    return null;
  }
};

/**
 * Start file store creation for an org unless one is already running.
 * Returns immediately; callers are expected to throw a retry-later error.
 * @param {Object} myOrganization - Home organization row
 */
const startFileStoreCreation = (myOrganization) => {
  const { orgUid } = myOrganization;

  if (pendingFileStoreCreations.has(orgUid)) {
    return;
  }

  pendingFileStoreCreations.add(orgUid);

  const create = async () => {
    // The caller's org snapshot may predate a creation that has since
    // finished, and the v2 model may have recorded the store for an
    // upgraded org; adopt any persisted id instead of minting another.
    const existingId = await findExistingFileStoreId(orgUid);
    if (existingId) {
      await Organization.update(
        { fileStoreId: existingId },
        { where: { orgUid } },
      );
      return;
    }

    await datalayer.waitForSpendableCoins(1);
    const newFileStoreId = await datalayer.createDataLayerStoreWithRetry();
    // Record the store before syncing. The store is already paid for on
    // chain, so losing the id to a sync failure would mint another one on
    // the next request; subsequent requests use the persisted id.
    await Organization.update(
      { fileStoreId: newFileStoreId },
      { where: { orgUid } },
    );
    try {
      await datalayer.syncDataLayer(orgUid, { fileStoreId: newFileStoreId });
    } catch (error) {
      // The store id is persisted and usable by subsequent requests; only
      // the org-store metadata push failed.
      logger.error(
        `File store ${newFileStoreId} for org ${orgUid} was created and recorded, ` +
          `but registering it on the org store failed: ${error.message}`,
      );
    }
  };

  create()
    .catch((error) => {
      logger.error(
        `Failed to create file store for org ${orgUid}: ${error.message}`,
      );
    })
    .finally(() => {
      pendingFileStoreCreations.delete(orgUid);
    });
};

class FileStore extends Model {
  static async subscribeToFileStore(orgUid) {
    const organization = await Organization.findByPk(orgUid, { raw: true });
    if (!organization) {
      throw new Error(`Org ${orgUid} does not exist`);
    }

    if (!organization.fileStoreId) {
      throw new Error(
        `Org ${orgUid} does not have a file store to subscribe to`,
      );
    }

    await datalayer.subscribeToStoreOnDataLayer(organization.fileStoreId);

    /* todo: this is code is now valid but it wasnt previously resulting in the records not updating and the filestore always
              being marked as not subscribed. at the moment, not sure what the impact of marking them as subscribed would
              be so leaving this commented out to revisit at a later date (today is 12/9/24)
    await Organization.update(
      { fileStoreSubscribed: true },
      {
        where: {
          orgUid,
        },
      },
    );

     */
  }

  static async unsubscribeFromFileStore(orgUid) {
    const organization = await Organization.findByPk(orgUid, { raw: true });
    if (!organization) {
      throw new Error(
        `Org ${orgUid} does not have a file store to unsubscribe from.`,
      );
    }

    FileStore.destroy({ where: { orgUid: organization.orgUid } });
    datalayer.unsubscribeFromDataLayerStore(organization.fileStoreId);
    Organization.update({ fileStoreSubscribed: false });
  }

  static async addFileToFileStore(SHA256, fileName, base64File) {
    const myOrganization = await Organization.getHomeOrg();

    if (!myOrganization) {
      throw new Error('No homeorg detected');
    }

    const fileStoreId = myOrganization.fileStoreId;

    if (myOrganization && !fileStoreId) {
      startFileStoreCreation(myOrganization);
      throw new Error('New File store being created, please try again later.');
    }

    const existingFile = await FileStore.findOne({
      where: { SHA256 },
      attributes: ['SHA256'],
    });

    if (existingFile) {
      throw new Error('File Already exists in the filestore');
    }

    datalayer.syncDataLayer(fileStoreId, {
      [SHA256]: JSON.stringify({
        name: fileName,
        file: base64File,
      }),
    });

    FileStore.upsert({
      SHA256,
      fileName,
      data: base64File,
      orgUid: myOrganization.orgUid,
    });
  }

  static async getFileStoreList() {
    const myOrganization = await Organization.getHomeOrg();
    const fileStoreId = myOrganization?.fileStoreId;

    if (myOrganization && !fileStoreId) {
      startFileStoreCreation(myOrganization);
      throw new Error('New File store being created, please try again later.');
    }

    if (fileStoreId) {
      new Promise((resolve, reject) => {
        datalayer.getStoreData(
          myOrganization.fileStoreId,
          (data) => {
            resolve(data);
          },
          reject,
        );
      }).then((fileStore) => {
        // Just caching this so dont await it, we dont care when it finishes
        return Promise.all(
          Object.keys(fileStore).map((key) => {
            FileStore.upsert({
              SHA256: fileStore[key].SHA256,
              fileName: key,
              data: fileStore[key].data,
              orgUid: myOrganization.orgUid,
            });
          }),
        );
      });
    }

    return FileStore.findAll({
      attributes: ['SHA256', 'fileName', 'orgUid'],
      raw: true,
    });
  }

  static async deleteFileStoreItem(SHA256) {
    const myOrganization = await Organization.getHomeOrg();
    const fileStoreId = myOrganization.fileStoreId;

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
      FileStore.destroy({ where: { SHA256, orgUid: myOrganization.orgUid } }),
    ]);
  }

  static async getFileStoreItem(SHA256) {
    const myOrganization = await Organization.getHomeOrg();
    const fileStoreId = myOrganization.fileStoreId;

    if (!fileStoreId) {
      startFileStoreCreation(myOrganization);
      throw new Error('New File store being created, please try again later.');
    }

    const cachedFile = await FileStore.findOne({
      where: { SHA256 },
      raw: true,
    });

    if (cachedFile) {
      return cachedFile.data;
    }

    const fileStore = await new Promise((resolve, reject) => {
      datalayer.getStoreData(
        myOrganization.fileStoreId,
        (data) => {
          resolve(data);
        },
        () => reject(),
      );
    });

    // Just caching this so dont await it, we dont care when it finishes
    FileStore.upsert({
      SHA256,
      fileName: fileStore[SHA256].fileName,
      data: fileStore[SHA256].data,
    });

    return fileStore[SHA256].data;
  }
}

FileStore.init(ModelTypes, {
  sequelize,
  modelName: 'fileStore',
  freezeTableName: true,
  timestamps: false,
  createdAt: false,
  updatedAt: false,
});

export { FileStore };
