'use strict';

import Sequelize from 'sequelize';
import _ from 'lodash';

const { Model } = Sequelize;

import { sequelize } from '../../database';

import datalayer from '../../datalayer';
import { logger } from '../../config/logger.js';
import { FileStore, Staging } from '../';

import { getDefaultOrganizationList } from '../../utils/data-loaders';

import { getDataModelVersion } from '../../utils/helpers';

import { getConfig } from '../../utils/config-loader';
const { USE_SIMULATOR, AUTO_SUBSCRIBE_FILESTORE } = getConfig().APP;

import ModelTypes from './organizations.modeltypes.cjs';
import {
  getOwnedStores,
  getSubscriptions,
} from '../../datalayer/persistance.js';
import { subscribeToStoreOnDataLayer } from '../../datalayer/simulator.js';

class Organization extends Model {
  static async getHomeOrg(includeAddress = true) {
    const myOrganization = await Organization.findOne({
      where: { isHome: true },
      raw: true,
    });

    if (myOrganization && myOrganization.metadata) {
      const parsedMetadata = JSON.parse(myOrganization.metadata);

      // Add each key from parsedMetadata to myOrganization
      for (const key in parsedMetadata) {
        if (Object.prototype.hasOwnProperty.call(parsedMetadata, key)) {
          myOrganization[key] = parsedMetadata[key];
        }
      }

      // Optionally, you can delete the original metadata property
      delete myOrganization.metadata;
    }

    if (myOrganization && includeAddress) {
      myOrganization.xchAddress = await datalayer.getPublicAddress();
      myOrganization.fileStoreSubscribed = true;
      return myOrganization;
    }

    if (myOrganization) {
      const pendingCommitsCount = await Staging.count({
        where: { commited: true },
      });

      myOrganization.synced =
        myOrganization.synced === 1 && pendingCommitsCount === 0;
    }

    return myOrganization;
  }

  static async getOrgsMap() {
    const organizations = await Organization.findAll({
      attributes: [
        'orgUid',
        'orgHash',
        'name',
        'icon',
        'isHome',
        'subscribed',
        'synced',
        'fileStoreSubscribed',
        'registryId',
        'registryHash',
        'sync_remaining',
      ],
    });

    for (let i = 0; i < organizations.length; i++) {
      if (organizations[i].dataValues.isHome) {
        organizations[i].dataValues.xchAddress =
          await datalayer.getPublicAddress();
        organizations[i].dataValues.balance =
          await datalayer.getWalletBalance();

        const pendingCommitsCount = await Staging.count({
          where: { commited: true },
        });

        organizations[i].dataValues.synced =
          organizations[i].dataValues.synced === true &&
          pendingCommitsCount === 0;
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

  static async appendNewRegistry(registryId, dataVersion) {
    const registryVersionId = await datalayer.createDataLayerStore();
    await datalayer.syncDataLayer(registryId, {
      [dataVersion]: registryVersionId,
    });

    return registryVersionId;
  }

  static async addMirror(storeId, url, force = false) {
    await datalayer.addMirror(storeId, url, force);
  }

  static async importOrganization(orgUid, isHome) {
    try {
      const homeOrgExists = Organization.getHomeOrg();
      if (isHome && homeOrgExists) {
        throw new Error(
          'cannot import home organization. home organization already exists on this instance',
        );
      }

      logger.info(`Importing ${isHome ? 'home' : ''} organization ${orgUid}`);
      logger.debug(
        isHome
          ? `checking that datalayer owns org store ${orgUid}`
          : `checking that datalayer is subscribed to org store ${orgUid}`,
      );

      const datalayerStoresResult = isHome
        ? await getOwnedStores()
        : await getSubscriptions();

      if (!datalayerStoresResult.success) {
        throw new Error(
          isHome
            ? 'failed to retrieve owned stores from datalayer'
            : 'failed to retrieve store subscriptions from datalayer',
        );
      }

      if (!datalayerStoresResult?.storeIds.includes(orgUid)) {
        throw new Error(
          isHome
            ? `your chia instance does not own store ${orgUid}. cannot import as home organization.`
            : `datalayer is not subscribed to store ${orgUid}. please subscribe to this store before importing the organization`,
        );
      }

      logger.info(`found orgUid store. attempting to import registry store`);

      const orgData = await datalayer.getCurrentStoreData(orgUid);
      const registryId = orgData?.registryId;

      if (!registryId) {
        throw new Error(
          `store ${orgUid} does not contain a valid registry storeId, can not import`,
        );
      }

      if (!datalayerStoresResult?.storeIds.includes(registryId)) {
        throw new Error(
          isHome
            ? `your chia instance does not own store ${registryId} belonging to organization store ${orgUid}. cannot import as home organization.`
            : `datalayer is NOT subscribed to registry store ${registryId} belonging to organization store ${orgUid}. please subscribe to this registry store before importing the organization`,
        );
      }

      logger.debug(`getting registry data from registry store ${registryId}`);
      const registryData = await datalayer.getCurrentStoreData(orgUid);

      const dataModelVersion = getDataModelVersion();

      if (!registryData[dataModelVersion]) {
        throw new Error(
          `organization ${orgUid} has no registry for the ${dataModelVersion} datamodel, can not import`,
        );
      }

      logger.info(
        `importing registry data from store ${registryId} (datamodel version ${dataModelVersion}) for organization ${orgUid}`,
      );

      logger.debug('upserting the following imported organization data', {
        orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registryId: registryData[dataModelVersion],
        subscribed: true,
        isHome,
      });

      await Organization.upsert({
        orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registryId: registryData[dataModelVersion],
        subscribed: true,
        isHome,
      });

      if (AUTO_SUBSCRIBE_FILESTORE && !isHome) {
        await FileStore.subscribeToFileStore(orgUid);
      }
    } catch (error) {
      // catch for logging purposes. need to re-throw to controller
      logger.error(`cannot import organization. Error: ${error.message}`);
      throw error;
    }
  }

  static async subscribeToOrganization(orgUid, registryId) {
    const subscribedStores = await getSubscriptions();
    if (!subscribedStores.success) {
      throw new Error('failed to contact datalayer');
    }

    const subscribedToOrgStore = subscribedStores.storeIds.includes(orgUid);
    const subscribedToRegistryStore =
      subscribedStores.storeIds.includes(registryId);

    if (!subscribedToOrgStore) {
      logger.info(
        `datalayer is not subscribed to orgUid store ${orgUid}, subscribing ...`,
      );

      const result = await subscribeToStoreOnDataLayer(orgUid, true);
      if (result) {
        logger.info(`subscribed to store ${orgUid}`);
      } else {
        const error = `failed to subscribe to store ${orgUid}`;
        logger.error(error);
        throw new Error(error);
      }

      // wait 5 secs to give RPC a break
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    if (!subscribedToRegistryStore) {
      logger.info(
        `datalayer is not subscribed to registryId store ${registryId}, subscribing ...`,
      );

      const result = await subscribeToStoreOnDataLayer(registryId, true);
      if (result) {
        logger.info(`subscribed to store ${registryId}`);
      } else {
        const error = `failed to subscribe to store ${registryId}`;
        logger.error(error);
        throw new Error(error);
      }

      // wait 5 secs to give RPC a break
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const exists = await Organization.findOne({ where: { orgUid } });
    if (exists) {
      await Organization.update({ subscribed: true }, { where: { orgUid } });
      return `successfully subscribed to organization ${orgUid} and its registry store ${registryId}`;
    } else {
      return (
        `successfully subscribed to organization store ${orgUid} the associated registry store ${registryId}. ` +
        `this organization does not exist in your cadt instance database. you will need to import the organization for ` +
        `cadt to begin syncing the organization's data. please allow a few minutes for datalayer to sync the store data ` +
        `before attempting to import.`
      );
    }
  }

  static async unsubscribeToOrganization(orgUid) {
    await Organization.update({ subscribed: false }, { orgUid });
  }

  /**
   * Synchronizes metadata for all subscribed organizations.
   */
  static async syncOrganizationMeta() {
    try {
      const allSubscribedOrganizations = await Organization.findAll({
        where: { subscribed: true },
      });

      await Promise.all(
        allSubscribedOrganizations.map(async (organization) => {
          const processData = (data, keyFilter) =>
            data
              .filter(({ key }) => keyFilter(key))
              .reduce(
                (update, { key, value }) => ({ ...update, [key]: value }),
                {},
              );

          const onFail = (message) => {
            logger.info(`Unable to sync metadata from ${organization.orgUid}`);
            logger.error(`ORGANIZATION DATA SYNC ERROR: ${message}`);
            Organization.update(
              { orgHash: '0' },
              { where: { orgUid: organization.orgUid } },
            );
          };

          const onResult = async (updateHash, data) => {
            try {
              const updateData = processData(
                data,
                (key) => !key.includes('meta_'),
              );
              const metadata = processData(data, (key) =>
                key.includes('meta_'),
              );

              await Organization.update(
                {
                  ..._.omit(updateData, ['registryId']),
                  prefix: updateData.prefix || '0',
                  metadata: JSON.stringify(metadata),
                },
                { where: { orgUid: organization.orgUid } },
              );

              logger.debug(
                `Updating orgUid ${organization.orgUid} with hash ${updateHash}`,
              );
              await Organization.update(
                { orgHash: updateHash },
                { where: { orgUid: organization.orgUid } },
              );
            } catch (error) {
              logger.info(error.message);
              onFail(error.message);
            }
          };

          datalayer.getStoreIfUpdated(
            organization.orgUid,
            organization.orgHash,
            onResult,
            onFail,
          );
        }),
      );
    } catch (error) {
      logger.info(error.message);
    }
  }

  static async subscribeToDefaultOrganizations() {
    try {
      const defaultOrgs = await getDefaultOrganizationList();
      if (!Array.isArray(defaultOrgs)) {
        throw new Error(
          'ERROR: Default Organization List Not found, This instance may be missing data from default orgs',
        );
      }

      for (let i = 0; i < defaultOrgs.length; i++) {
        const org = defaultOrgs[i];
        const exists = await Organization.findOne({
          where: { orgUid: org.orgUid },
        });

        if (!exists) {
          await Organization.importOrganization(org.orgUid);
        }
      }
    } catch (error) {
      logger.info(error);
    }
  }

  static async editOrgMeta({ name, icon }) {
    const myOrganization = await Organization.getHomeOrg();

    const payload = {};

    if (name) {
      payload.name = name;
    }

    if (icon) {
      payload.icon = icon;
    }

    await datalayer.upsertDataLayer(myOrganization.orgUid, payload);
  }

  static async addMetadata(payload) {
    const myOrganization = await Organization.getHomeOrg();

    // Prefix keys with "meta_"
    const metadata = _.mapKeys(payload, (_value, key) => `meta_${key}`);

    await datalayer.upsertDataLayer(myOrganization.orgUid, metadata);
  }

  static async removeMirror(storeId, coinId) {
    datalayer.removeMirror(storeId, coinId);
  }
}

Organization.init(ModelTypes, {
  sequelize,
  modelName: 'organization',
  timestamps: true,
});

export { Organization };
