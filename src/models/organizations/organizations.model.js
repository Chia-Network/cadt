'use strict';

import Sequelize from 'sequelize';
import _ from 'lodash';

const { Model } = Sequelize;

import { sequelize } from '../../database';

import datalayer from '../../datalayer';
import { logger } from '../../config/logger.cjs';
import { FileStore } from '../';

import { getDefaultOrganizationList } from '../../utils/data-loaders';

import { getDataModelVersion } from '../../utils/helpers';

import { getConfig } from '../../utils/config-loader';
const { USE_SIMULATOR, AUTO_SUBSCRIBE_FILESTORE } = getConfig().APP;

logger.info('CADT:organizations');

import ModelTypes from './organizations.modeltypes.cjs';

class Organization extends Model {
  static async getHomeOrg(includeAddress = true) {
    const myOrganization = await Organization.findOne({
      attributes: [
        'orgUid',
        'name',
        'icon',
        'subscribed',
        'registryId',
        'fileStoreId',
      ],
      where: { isHome: true },
      raw: true,
    });

    if (myOrganization && includeAddress) {
      myOrganization.xchAddress = await datalayer.getPublicAddress();
      myOrganization.fileStoreSubscribed = true;
      return myOrganization;
    }

    return undefined;
  }

  static async getOrgsMap() {
    const organizations = await Organization.findAll({
      attributes: [
        'orgUid',
        'name',
        'icon',
        'isHome',
        'subscribed',
        'fileStoreSubscribed',
      ],
    });

    for (let i = 0; i < organizations.length; i++) {
      if (organizations[i].dataValues.isHome) {
        organizations[i].dataValues.xchAddress =
          await datalayer.getPublicAddress();
        organizations[i].dataValues.balance =
          await datalayer.getWalletBalance();
        break;
      }
    }

    return organizations.reduce((map, current) => {
      map[current.orgUid] = current.dataValues;

      return map;
    }, {});
  }

  static async createHomeOrganization(name, icon, dataVersion = 'v1') {
    try {
      logger.info('Creating New Organization, This could take a while.');
      const myOrganization = await Organization.getHomeOrg();

      if (myOrganization) {
        return myOrganization.orgUid;
      }

      await Organization.create({
        orgUid: 'PENDING',
        registryId: null,
        isHome: true,
        subscribed: false,
        name: '',
        icon: '',
      });

      const newOrganizationId = USE_SIMULATOR
        ? 'f1c54511-865e-4611-976c-7c3c1f704662'
        : await datalayer.createDataLayerStore();

      const newRegistryId = await datalayer.createDataLayerStore();
      const registryVersionId = await datalayer.createDataLayerStore();
      const fileStoreId = await datalayer.createDataLayerStore();

      const revertOrganizationIfFailed = async () => {
        logger.info('Reverting Failed Organization');
        await Promise.all([
          Organization.destroy({ where: { orgUid: newOrganizationId } }),
          Organization.destroy({ where: { orgUid: 'PENDING' } }),
        ]);
      };

      if (!USE_SIMULATOR) {
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      // sync the organization store
      await datalayer.syncDataLayer(
        newOrganizationId,
        {
          registryId: newRegistryId,
          fileStoreId,
          name,
          icon,
        },
        revertOrganizationIfFailed,
      );

      if (!USE_SIMULATOR) {
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      //sync the registry store
      await datalayer.syncDataLayer(
        newRegistryId,
        {
          [dataVersion]: registryVersionId,
        },
        revertOrganizationIfFailed,
      );

      await new Promise((resolve) => setTimeout(() => resolve(), 30000));
      await datalayer.waitForAllTransactionsToConfirm();

      await Promise.all([
        Organization.create({
          orgUid: newOrganizationId,
          registryId: registryVersionId,
          isHome: true,
          subscribed: USE_SIMULATOR,
          fileStoreId,
          name,
          icon,
        }),
        Organization.destroy({ where: { orgUid: 'PENDING' } }),
      ]);

      const onConfirm = () => {
        logger.info('Organization confirmed, you are ready to go');
        Organization.update(
          {
            subscribed: true,
          },
          { where: { orgUid: newOrganizationId } },
        );
      };

      if (!USE_SIMULATOR) {
        logger.info('Waiting for New Organization to be confirmed');
        datalayer.getStoreData(
          newRegistryId,
          onConfirm,
          revertOrganizationIfFailed,
        );
      } else {
        onConfirm();
      }

      return newOrganizationId;
    } catch (error) {
      console.trace(error);
      logger.error(error.message);
      logger.info('Reverting Failed Organization');
      await Organization.destroy({ where: { isHome: true } });
    }
  }

  // eslint-disable-next-line
  static async appendNewRegistry(registryId, dataVersion) {
    const registryVersionId = await datalayer.createDataLayerStore();
    await datalayer.syncDataLayer(registryId, {
      [dataVersion]: registryVersionId,
    });

    return registryVersionId;
  }

  static async addMirror(storeId, coinId) {
    await datalayer.addMirror(storeId, coinId);
  }

  static async importHomeOrg(orgUid) {
    const orgData = await datalayer.getLocalStoreData(orgUid);

    if (!orgData) {
      throw new Error('Your node does not have write access to this orgUid');
    }

    const orgDataObj = orgData.reduce((obj, curr) => {
      console.log(curr);
      obj[curr.key] = curr.value;
      return obj;
    }, {});

    const registryData = await datalayer.getLocalStoreData(
      orgDataObj.registryId,
    );

    const registryDataObj = registryData.reduce((obj, curr) => {
      obj[curr.key] = curr.value;
      return obj;
    }, {});

    const dataModelVersion = getDataModelVersion();

    if (!registryDataObj[dataModelVersion]) {
      registryDataObj[dataModelVersion] = await Organization.appendNewRegistry(
        orgDataObj.registryId,
        dataModelVersion,
      );
    }

    await Organization.upsert({
      orgUid,
      name: orgDataObj.name,
      icon: orgDataObj.icon,
      registryId: registryDataObj[dataModelVersion],
      subscribed: true,
      isHome: true,
    });
  }

  // eslint-disable-next-line
  static importOrganization = async (orgUid) => {
    try {
      console.log('Importing organization ' + orgUid);
      const orgData = await datalayer.getSubscribedStoreData(orgUid);

      if (!orgData.registryId) {
        throw new Error(
          'Currupted organization, no registryId on the datalayer, can not import',
        );
      }

      logger.info(`IMPORTING REGISTRY: ${orgData.registryId}`);

      const registryData = await datalayer.getSubscribedStoreData(
        orgData.registryId,
      );

      const dataModelVersion = getDataModelVersion();

      if (!registryData[dataModelVersion]) {
        throw new Error(
          `Organization has no registry for the ${dataModelVersion} datamodel, can not import`,
        );
      }

      logger.info(`IMPORTING REGISTRY ${dataModelVersion}: `, registryData.v1);

      await datalayer.subscribeToStoreOnDataLayer(registryData.v1);

      logger.info({
        orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registryId: registryData[dataModelVersion],
        subscribed: true,
        isHome: false,
      });

      await Organization.upsert({
        orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registryId: registryData[dataModelVersion],
        subscribed: true,
        isHome: false,
      });

      if (AUTO_SUBSCRIBE_FILESTORE) {
        await FileStore.subscribeToFileStore(orgUid);
      }
    } catch (error) {
      logger.info(error.message);
    }
  };

  // eslint-disable-next-line
  static subscribeToOrganization = async (orgUid) => {
    const exists = await Organization.findOne({ where: { orgUid } });
    if (exists) {
      await Organization.update({ subscribed: true }, { where: { orgUid } });
    } else {
      throw new Error(
        'Can not subscribe, please import this organization first',
      );
    }
  };

  // eslint-disable-next-line
  static unsubscribeToOrganization = async (orgUid) => {
    await Organization.update({ subscribed: false }, { orgUid });
  };

  static syncOrganizationMeta = async () => {
    try {
      const allSubscribedOrganizations = await Organization.findAll({
        subscribed: true,
      });

      await Promise.all(
        allSubscribedOrganizations.map((organization) => {
          const onResult = (data) => {
            const updateData = data
              .filter((pair) => !pair.key.includes('meta_'))
              .reduce((update, current) => {
                update[current.key] = current.value;
                return update;
              }, {});

            // will return metadata fields. i.e.: { meta_key1: 'value1', meta_key2: 'value2' }
            const metadata = data
              .filter((pair) => pair.key.includes('meta_'))
              .reduce((update, current) => {
                update[current.key] = current.value;
                return update;
              }, {});

            Organization.update(
              {
                ..._.omit(updateData, ['registryId']),
                metadata: JSON.stringify(metadata),
              },
              {
                where: { orgUid: organization.orgUid },
              },
            );
          };

          const onUpdate = (updateHash) => {
            Organization.update(
              { orgHash: updateHash },
              {
                where: { orgUid: organization.orgUid },
              },
            );
          };

          const onFail = () => {
            logger.info(`Unable to sync metadata from ${organization.orgUid}`);
          };

          datalayer.getStoreIfUpdated(
            organization.orgUid,
            organization.orgHash,
            onUpdate,
            onResult,
            onFail,
          );
        }),
      );
    } catch (error) {
      logger.info(error.message);
    }
  };

  static subscribeToDefaultOrganizations = async () => {
    try {
      const defaultOrgs = await getDefaultOrganizationList();
      if (!Array.isArray(defaultOrgs)) {
        throw new Error(
          'ERROR: Default Organization List Not found, This instance may be missing data from default orgs',
        );
      }

      await Promise.all(
        defaultOrgs.map(async (org) => {
          const exists = await Organization.findOne({
            where: { orgUid: org.orgUid },
          });

          if (!exists) {
            Organization.importOrganization(org.orgUid);
          }
        }),
      );
    } catch (error) {
      logger.info(error);
    }
  };

  static editOrgMeta = async ({ name, icon }) => {
    const myOrganization = await Organization.getHomeOrg();

    const payload = {};

    if (name) {
      payload.name = name;
    }

    if (icon) {
      payload.icon = icon;
    }

    await datalayer.upsertDataLayer(myOrganization.orgUid, payload);
  };

  static addMetadata = async (payload) => {
    const myOrganization = await Organization.getHomeOrg();

    // Prefix keys with "meta_"
    const metadata = _.mapKeys(payload, (_value, key) => `meta_${key}`);

    await datalayer.upsertDataLayer(myOrganization.orgUid, metadata);
  };

  static removeMirror = async (storeId, coinId) => {
    datalayer.removeMirror(storeId, coinId);
  };
}

Organization.init(ModelTypes, {
  sequelize,
  modelName: 'organization',
  timestamps: true,
});

export { Organization };
