'use strict';

/*
  We use the SHA256 hash as the unique file ID,
  this prevents duplicate files from being uploaded to the same store.
*/

import Sequelize from 'sequelize';
const { Model, Organization } = Sequelize;
import { sequelize } from '../../database';

import datalayer from '../../datalayer';

import ModelTypes from './file-store.modeltypes.cjs';

class FileStore extends Model {
  static async addFileToFileStore(SHA256, fileName, base64File) {
    const myOrganization = await Organization.getHomeOrg();
    let fileStoreId = myOrganization.fileStoreId;

    if (!fileStoreId) {
      fileStoreId = await datalayer.createDataLayerStore();
      datalayer.syncDataLayer(myOrganization.orgUid, { fileStoreId });
      throw new Error('New File store being created, please try again later.');
    }

    await datalayer.syncDataLayer(fileStoreId, {
      [SHA256]: {
        name: fileName,
        file: base64File,
      },
    });

    FileStore.upsert({
      SHA256,
      fileName,
      data: base64File,
    });
  }

  static async getFileStoreList() {
    const myOrganization = await Organization.getHomeOrg();
    let fileStoreId = myOrganization.fileStoreId;

    if (!fileStoreId) {
      fileStoreId = await datalayer.createDataLayerStore();
      datalayer.syncDataLayer(myOrganization.orgUid, { fileStoreId });
      throw new Error('New File store being created, please try again later.');
    }

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

    return FileStore.findAll({
      attributes: ['SHA256', 'fileName'],
      raw: true,
    });
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
