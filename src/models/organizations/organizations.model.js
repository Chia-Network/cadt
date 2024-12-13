'use strict';

import Sequelize from 'sequelize';
import _ from 'lodash';

const { Model } = Sequelize;

import { sequelize } from '../../database';

import datalayer from '../../datalayer';
import { logger } from '../../config/logger.js';
import { FileStore, Staging } from '../';
import { getDataModelVersion } from '../../utils/helpers';
import { getConfig } from '../../utils/config-loader';
const { USE_SIMULATOR, AUTO_SUBSCRIBE_FILESTORE } = getConfig().APP;

import ModelTypes from './organizations.modeltypes.cjs';
import { assertStoreIsOwned } from '../../utils/data-assertions.js';
import { getRoot, getSyncStatus } from '../../datalayer/persistance.js';

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
        modelVersionStoreId: null,
        isHome: true,
        subscribed: false,
        name: '',
        icon: '',
      });

      logger.debug('createHomeOrg() is creating organization (orgUid) store');
      const newOrganizationId = USE_SIMULATOR
        ? 'f1c54511-865e-4611-976c-7c3c1f704662'
        : await datalayer.createDataLayerStore();

      logger.debug('createHomeOrg() is creating registryId store');
      const registryStoreId = await datalayer.createDataLayerStore();

      logger.debug('createHomeOrg() is creating dataModelVersionId store');
      const dataModelVersionStoreId = await datalayer.createDataLayerStore();

      logger.debug('createHomeOrg() is creating file store');
      const fileStoreId = await datalayer.createDataLayerStore();

      const revertOrganizationIfFailed = async () => {
        logger.error(
          'create organization process failed. removing failed home organization records. please try again',
        );
        await Promise.all([
          Organization.destroy({ where: { orgUid: newOrganizationId } }),
          Organization.destroy({ where: { orgUid: 'PENDING' } }),
        ]);
      };

      if (!USE_SIMULATOR) {
        logger.info(
          'create organization process is waiting for all store creations to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      logger.debug(
        `the blockchain reported new organization stores orgUid: ${newOrganizationId}, ` +
          `dataModelVersionStore: ${dataModelVersionStoreId}, registryId: ${registryStoreId} have confirmed. `,
      );
      logger.info(
        `commiting organization data to orgUid store ${newOrganizationId}`,
      );
      // sync the organization store
      await datalayer.syncDataLayer(
        newOrganizationId,
        {
          registryId: registryStoreId,
          fileStoreId,
          name,
          icon,
        },
        revertOrganizationIfFailed,
      );

      if (!USE_SIMULATOR) {
        logger.info(
          'create organization process is waiting for organization data commited to orgUid store to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      logger.info(
        `commiting registry data model version data to data model version store ${dataModelVersionStoreId}`,
      );
      await datalayer.syncDataLayer(
        registryStoreId,
        {
          [dataVersion]: dataModelVersionStoreId,
        },
        revertOrganizationIfFailed,
      );

      logger.info(
        'create organization process is waiting for data model version to confirm on the blockchain',
      );
      await new Promise((resolve) => setTimeout(() => resolve(), 30000));
      await datalayer.waitForAllTransactionsToConfirm();

      logger.info('adding new home organization to CADT database');
      await Promise.all([
        Organization.create({
          orgUid: newOrganizationId,
          registryId: dataModelVersionStoreId,
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
          registryStoreId,
          onConfirm,
          revertOrganizationIfFailed,
        );
      } else {
        onConfirm();
      }

      return newOrganizationId;
    } catch (error) {
      logger.error(
        `create organization process failed. removing failed home organization records. please try again. Error: ${error.message}`,
      );
      await Organization.destroy({ where: { isHome: true } });
    }
  }

  static async addMirror(storeId, url, force = false) {
    await datalayer.addMirror(storeId, url, force);
  }

  /**
   * subscribes to an organization and reconciles the organization table store records against datalayer's store records
   *
   * if validating a home org, asserts all stores related to organization are owned.
   *
   * NOTE: assertions should be used at the controller level, but given that the data model version store id
   * and registry store id need to be derived as part of this process, this function asserts their ownership status
   * @param organization the organization table record of the organization to reconcile
   * @returns {Promise<void>}
   * @throws Error on failure. call in a try block
   */
  static async reconcileOrganization(organization) {
    if (!organization) {
      throw new Error('organization to reconcile must not be nil');
    }

    if (organization.orgUid === 'PENDING') {
      logger.info(
        'skipping organization reconciliation for pending home organization',
      );
      return;
    }

    const orgReduced = organization;
    delete orgReduced.icon;
    delete orgReduced.metadata;
    logger.debug(
      `reconciling organization ${orgReduced.orgUid} storeIds against datalayer. organization data from db (icon and metadata removed for compactness): ${JSON.stringify(orgReduced)}`,
    );
    const { name, orgUid, registryId, dataModelVersionStoreId, isHome } =
      organization;

    if (!orgUid) {
      throw new Error(
        `organization record is missing orgUid. the organization is unusable in this state. organization record: ${JSON.stringify(organization)}`,
      );
    }

    if (isHome) {
      try {
        await assertStoreIsOwned(orgUid);
      } catch {
        throw new Error(
          `orgUid store ${orgUid} is not owned by this chia wallet. CADT cannot correct this issue. please contact your administrator`,
        );
      }
    }

    logger.debug(
      `running the organization model subscription process on ${orgUid}`,
    );

    let organizationStoreIdsFromDatalayer = null;
    try {
      organizationStoreIdsFromDatalayer =
        await Organization.subscribeToOrganization(orgUid);
    } catch (error) {
      logger.error(
        `failure validating or adding subscriptions for org import. cannot import. Error: ${error.message}`,
      );
      throw new Error(
        `failed to subscribe to, or validate subscribed store data for, organization ${orgUid}`,
      );
    }

    const {
      dataModelVersionStoreId: datalayerDataModelVersionStoreId,
      registryStoreId: datalayerRegistryStoreId,
    } = organizationStoreIdsFromDatalayer;
    if (isHome) {
      try {
        await assertStoreIsOwned(datalayerDataModelVersionStoreId);
      } catch {
        throw new Error(
          `datamodel version store ${datalayerDataModelVersionStoreId} is not owned by this chia wallet. CADT cannot correct this issue. please contact your administrator`,
        );
      }

      try {
        await assertStoreIsOwned(datalayerRegistryStoreId);
      } catch {
        throw new Error(
          `registry store ${datalayerRegistryStoreId} is not owned by this chia wallet. CADT cannot correct this issue. please contact your administrator`,
        );
      }
    }

    const updatedOrganizationData = { subscribed: true };

    if (dataModelVersionStoreId !== datalayerDataModelVersionStoreId) {
      const message =
        `data layer reports that the data model version store id for ${name} (orgUid ${orgUid}) is ${datalayerDataModelVersionStoreId}, ` +
        `but the organization table record shows the store id as ${dataModelVersionStoreId}. correcting organization table record`;
      logger.warn(message);
      updatedOrganizationData.dataModelVersionStoreId =
        datalayerDataModelVersionStoreId;
    }

    if (registryId !== datalayerRegistryStoreId) {
      const message =
        `data layer reports that the registry store id for ${name} (orgUid ${orgUid}) ` +
        `is ${organizationStoreIdsFromDatalayer.dataModelVersionStoreId}, but found ${dataModelVersionStoreId} in ` +
        `organizaation table record. correcting organization table record`;
      logger.warn(message);
      updatedOrganizationData.dataModelVersionStoreId =
        datalayerDataModelVersionStoreId;
    }

    const isDlSynced = (syncStatus) => {
      return syncStatus.generation === syncStatus.target_generation;
    };

    // note that we only update the data model version store hash here because the other two store hashes are updated elsewhere
    const dataModelVersionStoreSyncStatus = await getSyncStatus(
      datalayerDataModelVersionStoreId,
    );
    if (isDlSynced(dataModelVersionStoreSyncStatus)) {
      const { hash } = await getRoot(datalayerDataModelVersionStoreId);
      if (hash !== organization.dataModelVersionStoreHash) {
        logger.info(
          `updating data model version store ${datalayerDataModelVersionStoreId} root hash to ${hash} from ${organization.dataModelVersionStoreHash}`,
        );
        updatedOrganizationData.dataModelVersionStoreHash = hash;
      }
    }

    try {
      await Organization.update(updatedOrganizationData, { where: { orgUid } });
    } catch {
      throw new Error(
        'failed to write updated organization data to organization table',
      );
    }
  }

  /**
   * subscribes to and imports an organization.
   *
   * if importing as home, asserts all stores related to organization are owned.
   *
   * NOTE: assertions should be used at the controller level, but given that the data model version store id
   * and registry store id need to be derived as part of this process, this function asserts their ownership status
   * @param orgUid the orgUid of the organization to import
   * @param isHome import the org as a home org
   * @returns {Promise<void>}
   */
  static async importOrganization(orgUid, isHome = false) {
    if (isHome) {
      try {
        await assertStoreIsOwned(orgUid);
      } catch {
        throw new Error(
          `orgUid store ${orgUid} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
        );
      }
    }

    logger.info(`importing organization ${orgUid} ${isHome && 'as home'}`);
    logger.debug(
      `running the organization model subscription process on ${orgUid}`,
    );

    let storeIds = null;
    try {
      storeIds = await Organization.subscribeToOrganization(orgUid);
    } catch (error) {
      logger.error(
        `failure validating or adding subscriptions for org import. cannot import. Error: ${error.message}`,
      );
      throw new Error(
        `failed to subscribe to, or validate subscribed store data for, organization ${orgUid}`,
      );
    }

    if (isHome) {
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

    const orgData = await datalayer.getCurrentStoreData(storeIds.orgUid);
    if (!orgData) {
      throw new Error(`failed to get organization data for ${orgUid}`);
    }

    const dataModelInfo = await datalayer.getCurrentStoreData(
      storeIds.dataModelVersionStoreId,
    );
    if (!dataModelInfo) {
      throw new Error(
        `failed to determine datamodel version for organization ${orgUid}`,
      );
    }

    const instanceDataModelVersion = getDataModelVersion();
    if (!dataModelInfo[instanceDataModelVersion]) {
      throw new Error(
        `this cadt instance is using datamodel version ${instanceDataModelVersion}. organization ${orgUid} does not have data for this datamodel. cannot import`,
      );
    }

    const organizationData = {
      orgUid,
      name: orgData.name,
      icon: orgData.icon,
      registryId: storeIds.registryStoreId,
      dataModelVersionStoreId: storeIds.dataModelVersionStoreId,
      fileStoreId: orgData?.fileStoreId,
      subscribed: true,
      isHome: false,
    };
    logger.info(
      `adding and organization with the following info ${organizationData}`,
    );

    await Organization.create(organizationData);
  }

  /**
   * Subscribes to all 3 required stores for a CADT organization and returns the store id's from datalayer.
   *
   * This function CAN BE RUN even if the organization is fully subscribed.
   *
   * CADT organization stores:
   * <ul>
   *   <li><strong>Organization Store</strong> (identified by `orgUid`):
   *     <ul>
   *       <li>Tracks the organization identifier (`orgUid`).</li>
   *       <li>Contains metadata and the identifier for the associated data model version store.</li>
   *     </ul>
   *   </li>
   *   <li><strong>Registry Data Model Version Store</strong>:
   *     <ul>
   *       <li>Identified using the `registryId` key from the organization store data.</li>
   *       <li>Tracks the registry store identifiers for different data model versions (e.g., `v1`).</li>
   *       <li>Note: Despite the misleading key name, this is NOT the registry store ID itself.</li>
   *     </ul>
   *   </li>
   *   <li><strong>Registry Store</strong>:
   *     <ul>
   *       <li>Contains the organization’s climate data for a specific data model version.</li>
   *       <li>Located at the version key (e.g., `v1`) in the data model version store.</li>
   *     </ul>
   *   </li>
   * </ul>
   *
   * @param {string} orgUid - The unique identifier of the organization to subscribe to.
   * @returns {Promise<{orgUid: string, dataModelVersionStoreId: string, registryStoreId: string}>}
   *          Resolves to an object containing:
   *          - `orgUid`: The unique identifier of the organization.
   *          - `dataModelVersionStoreId`: The identifier of the data model version store.
   *          - `registryStoreId`: The identifier of the registry store.
   */

  static async subscribeToOrganization(orgUid) {
    if (orgUid === 'PENDING') {
      logger.info('cannot subscribe to a home organization while its pending.');
    }

    logger.debug(
      `running the organization subscription process on organization ${orgUid})`,
    );

    // we'll give datalayer 10 minutes to get data where it needs to be and complete this process
    const timeout = Date.now() + 600000;
    const reachedTimeout = () => {
      return Date.now() > timeout;
    };
    const onTimeout = (error) => {
      const message = `reached timeout before subscribing to all required stores. Failure at time out: ${error.message}`;
      logger.error(message);
      throw new Error(message);
    };

    logger.debug(
      `determining datamodel version singleton id for org ${orgUid}`,
    );
    let dataModelVersionStoreId = null;
    while (!dataModelVersionStoreId) {
      try {
        const orgStoreData = await datalayer.getSubscribedStoreData(orgUid);
        // here registryId is actually the data model version store that points to the registry store
        dataModelVersionStoreId = orgStoreData?.registryId;
        if (!dataModelVersionStoreId) {
          throw new Error(
            `failed to get registry datamodel version singleton id from orgUid store ${orgUid}. rpc function returned: ${orgStoreData}`,
          );
        }
        logger.debug(
          `the registry datamodel version pointer singleton id for organization ${orgUid} is ${dataModelVersionStoreId}`,
        );
      } catch (error) {
        if (reachedTimeout()) {
          onTimeout(error);
        }
        logger.debug(`${error.message}. RETRYING`);
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    logger.debug(`determining registry store singleton id for org ${orgUid}`);
    let registryStoreId = null;
    while (!registryStoreId) {
      try {
        const dataModelVersionStoreData =
          await datalayer.getSubscribedStoreData(dataModelVersionStoreId);
        // here v1 is actually the registry store id
        registryStoreId = dataModelVersionStoreData?.v1;
        if (!registryStoreId) {
          throw new Error(
            `failed to get registry singleton id from datamodel version singleton store ${dataModelVersionStoreId}. rpc function returned: ${dataModelVersionStoreData}`,
          );
        }
        logger.debug(
          `the registry singleton id for organization ${orgUid} is ${dataModelVersionStoreId}`,
        );
      } catch (error) {
        if (reachedTimeout()) {
          onTimeout(error);
        }
        logger.debug(`${error.message}. RETRYING`);
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    logger.debug(`checking registry store singleton for org ${orgUid}`);
    const subscribedToRegistryStore =
      await datalayer.subscribeToStoreOnDataLayer(registryStoreId);
    if (!subscribedToRegistryStore) {
      throw new Error(
        `failed to subscribe to or validate subscription for registry store ${registryStoreId}`,
      );
    }

    if (AUTO_SUBSCRIBE_FILESTORE) {
      logger.info(`subscribing to file store for organization ${orgUid}`);
      try {
        await FileStore.subscribeToFileStore(orgUid);
      } catch (error) {
        logger.warn(
          `failed to subscribe to file store. Error: ${error.message}`,
        );
      }
    }

    return {
      orgUid,
      dataModelVersionStoreId,
      registryStoreId,
    };
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
          logger.info(`Unable to sync metadata from ${organization.orgUid}`);
          logger.error(`ORGANIZATION DATA SYNC ERROR: ${message}`);
          await Organization.update(
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
            const metadata = processData(data, (key) => key.includes('meta_'));

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

        await datalayer.getStoreIfUpdated(
          organization.orgUid,
          organization.orgHash,
          onResult,
          onFail,
        );
      }
    } catch (error) {
      logger.error(error.message);
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
