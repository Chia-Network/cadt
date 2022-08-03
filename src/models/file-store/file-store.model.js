'use strict';

/*
  We use the SHA256 hash as the unique file ID,
  this prevents duplicate files from being uploaded to the same store.
*/

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../../database';
import { Organization } from '../organizations';

import datalayer from '../../datalayer';

import ModelTypes from './file-store.modeltypes.cjs';

class FileStore extends Model {
  static async addFileToFileStore(SHA256, fileName, base64File) {
    const myOrganization = await Organization.getHomeOrg();
    let fileStoreId = myOrganization.fileStoreId;

    if (!fileStoreId) {
      fileStoreId = datalayer.createDataLayerStore();
      datalayer.syncDataLayer(myOrganization.orgUid, { fileStoreId });
      Organization.update(
        { fileStoreId },
        { where: { orgUid: myOrganization.orgUid } },
      );
      throw new Error('New File store being created, please try again later.');
    }

    const existingFile = await FileStore.findOne({
      where: { SHA256 },
      attributes: ['SHA256'],
    });

    console.log(SHA256);

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
