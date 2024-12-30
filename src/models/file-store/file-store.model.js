'use strict';

/*
  We use the SHA256 hash as the unique file ID,
  this prevents duplicate files from being uploaded to the same store.
*/

import Sequelize from 'sequelize';

const { Model } = Sequelize;
import { sequelize } from '../../database';
import { Organization } from '../';

import datalayer from '../../datalayer';
import { encodeHex } from '../../utils/datalayer-utils';

import ModelTypes from './file-store.modeltypes.cjs';

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
              be so leaving this commented out to revisit at a later date (today is 12/30/24)
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

    let fileStoreId = myOrganization.fileStoreId;

    if (myOrganization && !fileStoreId) {
      datalayer.createDataLayerStore().then((fileStoreId) => {
        datalayer.syncDataLayer(myOrganization.orgUid, { fileStoreId });
        Organization.update(
          { fileStoreId },
          { where: { orgUid: myOrganization.orgUid } },
        );
      });

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
    let fileStoreId = myOrganization?.fileStoreId;

    if (myOrganization && !fileStoreId) {
      datalayer.createDataLayerStore().then((fileStoreId) => {
        datalayer.syncDataLayer(myOrganization.orgUid, { fileStoreId });
        Organization.update(
          { fileStoreId },
          { where: { orgUid: myOrganization.orgUid } },
        );
      });
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
    let fileStoreId = myOrganization.fileStoreId;

    if (!fileStoreId) {
      datalayer.createDataLayerStore().then((fileStoreId) => {
        datalayer.syncDataLayer(myOrganization.orgUid, { fileStoreId });
        Organization.update(
          { fileStoreId },
          { where: { orgUid: myOrganization.orgUid } },
        );
      });
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
    let fileStoreId = myOrganization.fileStoreId;

    if (!fileStoreId) {
      fileStoreId = await datalayer.createDataLayerStore();
      datalayer.syncDataLayer(myOrganization.orgUid, { fileStoreId });
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
