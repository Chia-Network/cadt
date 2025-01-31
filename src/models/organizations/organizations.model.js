'use strict';

import Sequelize from 'sequelize';
import _ from 'lodash';
import { sequelize } from '../../database';
import datalayer from '../../datalayer';
import { logger } from '../../logger.js';
import { Audit, FileStore, Meta, ModelKeys, Staging } from '../';
import { getDataModelVersion } from '../../utils/helpers';
import { CONFIG } from '../../user-config';
import ModelTypes from './organizations.modeltypes.cjs';
import { assertStoreIsOwned } from '../../utils/data-assertions.js';
import {
  getRoot,
  getSubscriptions,
  getSyncStatus,
} from '../../datalayer/persistance.js';
import {
  addOrDeleteOrganizationRecordMutex,
  processingSyncRegistriesTransactionMutex,
} from '../../utils/model-utils.js';
import { isDlStoreSynced } from '../../utils/datalayer-utils.js';

const { Model } = Sequelize;

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
        'prefix',
        'isHome',
        'subscribed',
        'synced',
        'fileStoreSubscribed',
        'registryId',
        'registryHash',
        'sync_remaining',
        'dataModelVersionStoreId',
        'dataModelVersionStoreHash',
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

  static async createHomeOrganization({
    name,
    prefix = '0',
    icon,
    dataVersion = 'v1',
  }) {
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

      logger.info('createHomeOrg() is creating organization (orgUid) store');
      const newOrganizationId = CONFIG().CADT.USE_SIMULATOR
        ? 'f1c54511-865e-4611-976c-7c3c1f704662'
        : await datalayer.createDataLayerStore();

      logger.info('createHomeOrg() is creating registryId store');
      const registryStoreId = await datalayer.createDataLayerStore();

      logger.info('createHomeOrg() is creating dataModelVersionId store');
      const dataModelVersionStoreId = await datalayer.createDataLayerStore();

      logger.info('createHomeOrg() is creating file store');
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

      if (!CONFIG().CADT.USE_SIMULATOR) {
        logger.info(
          'create organization process is waiting for all store creations to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      logger.info(
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
          registryId: dataModelVersionStoreId, // registryId is the key named here, but this the DATA MODEL VERSION store id
          fileStoreId,
          name,
          icon,
          prefix,
        },
        revertOrganizationIfFailed,
      );

      if (!CONFIG().CADT.USE_SIMULATOR) {
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
        dataModelVersionStoreId,
        {
          [dataVersion]: registryStoreId,
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
          dataModelVersionStoreId,
          registryId: registryStoreId,
          isHome: true,
          subscribed: CONFIG().CADT.USE_SIMULATOR,
          fileStoreId,
          name,
          icon,
          prefix,
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

      if (!CONFIG().CADT.USE_SIMULATOR) {
        logger.info('Waiting for New Organization to be confirmed');
        await datalayer.getStoreData(
          newOrganizationId,
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
    if (CONFIG().CADT.USE_SIMULATOR) {
      return;
    }

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
    logger.task(
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
        `failed to subscribe to, or validate subscribed store data for organization ${orgUid}. Error: ${error.message}`,
      );
      throw new Error(
        `failed to subscribe to, or validate subscribed store data for organization ${orgUid}`,
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

    const updatedOrganizationData = {};

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

    // note that we only update the data model version store hash here because the other two store hashes are updated elsewhere
    const dataModelVersionStoreSyncStatus = await getSyncStatus(
      datalayerDataModelVersionStoreId,
    );

    if (isDlStoreSynced(dataModelVersionStoreSyncStatus)) {
      const { confirmed, hash } = await getRoot(
        datalayerDataModelVersionStoreId,
      );
      if (confirmed && hash !== organization.dataModelVersionStoreHash) {
        logger.info(
          `data model version store ${datalayerDataModelVersionStoreId} root hash needs to be updated ${hash} ` +
            `from ${organization.dataModelVersionStoreHash} to ${hash}`,
        );
        updatedOrganizationData.dataModelVersionStoreHash = hash;
      } else if (!confirmed) {
        logger.warn(
          `data model version store ${datalayerDataModelVersionStoreId} has not been confirmed yet. cannot validate or update hash.`,
        );
      }
    }

    if (!organization.subscribed) {
      updatedOrganizationData.subscribed = true;
    }

    if (!_.isEmpty(updatedOrganizationData)) {
      logger.info(
        `reconcile organization task is updating organization ${organization.orgUid} with the following data ${JSON.stringify(updatedOrganizationData)}`,
      );
      try {
        await Organization.update(updatedOrganizationData, {
          where: { orgUid },
        });
      } catch {
        throw new Error(
          'failed to write updated organization data to organization table',
        );
      }
    } else {
      logger.info(
        `reconcile organization task found organization ${organization.orgUid} required no updates or corrections`,
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
    logger.debug('acquiring mutex to import organization');
    const releaseMutex = await addOrDeleteOrganizationRecordMutex.acquire();

    // any error caught is re-thrown. this outer try is here because we need to release a mutex
    try {
      if (isHome) {
        try {
          await assertStoreIsOwned(orgUid);
        } catch {
          throw new Error(
            `orgUid store ${orgUid} is not owned by this chia wallet. cannot import organization ${orgUid} as home`,
          );
        }
      }

      await Meta.removeUserDeletedOrgUid(orgUid);

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
        isHome,
      };
      logger.info(
        `adding an organization with the following info ${organizationData.toString()}`,
      );

      await Organization.create(organizationData);
    } catch (error) {
      throw new Error(error.message);
    } finally {
      releaseMutex();
    }
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
    let orgStoreData = null;
    while (!orgStoreData) {
      try {
        orgStoreData = await datalayer.getSubscribedStoreData(
          orgUid,
          undefined,
          true,
        );
      } catch (error) {
        if (reachedTimeout()) {
          onTimeout(error);
        }
        logger.debug(`${error.message}. RETRYING`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    // here registryId is actually the data model version store that points to the registry store
    const dataModelVersionStoreId = orgStoreData.registryId;
    if (!dataModelVersionStoreId) {
      throw new Error(
        `failed to get registry datamodel version singleton id from orgUid store ${orgUid}. rpc function returned: ${orgStoreData}`,
      );
    }
    logger.debug(
      `the registry datamodel version pointer singleton id for organization ${orgUid} is ${dataModelVersionStoreId}`,
    );

    logger.debug(`determining registry store singleton id for org ${orgUid}`);
    let dataModelVersionStoreData = null;
    while (!dataModelVersionStoreData) {
      try {
        dataModelVersionStoreData = await datalayer.getSubscribedStoreData(
          dataModelVersionStoreId,
          undefined,
          true,
        );
      } catch (error) {
        if (reachedTimeout()) {
          onTimeout(error);
        }
        logger.debug(`${error.message}. RETRYING`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    // here v1 is actually the registry store id
    const registryStoreId = dataModelVersionStoreData?.v1;
    if (!registryStoreId) {
      throw new Error(
        `failed to get registry singleton id from datamodel version singleton store ${dataModelVersionStoreId}. rpc function returned: ${dataModelVersionStoreData}`,
      );
    }
    logger.debug(
      `the registry singleton id for organization ${orgUid} is ${registryStoreId}`,
    );

    logger.debug(`checking registry store singleton for org ${orgUid}`);
    const subscribedToRegistryStore =
      await datalayer.subscribeToStoreOnDataLayer(registryStoreId);
    if (!subscribedToRegistryStore) {
      throw new Error(
        `failed to subscribe to or validate subscription for registry store ${registryStoreId}`,
      );
    }

    if (CONFIG().CADT.AUTO_SUBSCRIBE_FILESTORE) {
      logger.info(`subscribing to file store for organization ${orgUid}`);
      try {
        await FileStore.subscribeToFileStore(orgUid);
      } catch (error) {
        logger.warn(
          `failed to subscribe to file store. Error: ${error.message}`,
        );
      }
    }

    const organization = await Organization.findOne({
      where: { orgUid },
      raw: true,
    });
    if (organization) {
      logger.info(`marking existing organization record as subscribed`);
      await Organization.update({ subscribed: true }, { where: { orgUid } });
    }

    return {
      orgUid,
      dataModelVersionStoreId,
      registryStoreId,
    };
  }

  /**
   *
   * @param {Organization | Object} organizationStores
   * @param {string} organizationStores.orgUid
   * @param {string} organizationStores.dataModelVersionStoreId
   * @param {string} organizationStores.registryId
   * @returns {Promise<void>}
   */
  static async unsubscribeFromOrganizationStores(organizationStores) {
    const { storeIds: subscriptionIds, success } = await getSubscriptions();
    if (!success) {
      throw new Error('failed to get subscriptions from datalayer');
    }

    const storesToUnsubscribe = [
      organizationStores.orgUid,
      organizationStores.dataModelVersionStoreId,
      organizationStores.registryId,
    ];
    const failedUnsubscribes = [];

    storesToUnsubscribe.forEach((storeId) => {
      if (!storeId) {
        const message = `organization stores cannot be nil. found nil store id associated with organization ${organizationStores.orgUid}`;
        logger.error(message);
        throw new Error(message);
      }
    });

    for (const storeId of storesToUnsubscribe) {
      if (subscriptionIds.includes(storeId)) {
        logger.info(
          `unsubscribing from store ${storeId} associated with organization ${organizationStores.orgUid}`,
        );
        try {
          await datalayer.unsubscribeFromDataLayerStoreWithRetry(storeId);
        } catch (error) {
          logger.error(
            `unsubscribeFromOrganization() encountered an error: ${error.message}`,
          );
          failedUnsubscribes.push(storeId);
        }
      }
    }

    if (failedUnsubscribes.length) {
      const message = `failed to unsubscribe from the following organization stores: ${failedUnsubscribes}`;
      logger.error(message);
      throw new Error(message);
    }

    const orgExistsInDb = await Organization.findOne({
      where: { orgUid: organizationStores.orgUid },
      raw: true,
    });

    if (orgExistsInDb) {
      await Organization.update(
        { subscribed: false },
        { where: { orgUid: organizationStores.orgUid } },
      );
    }
  }

  /**
   * removes all records of an organization from all models with an `orgUid` column
   * @param orgUid
   */
  static async deleteAllOrganizationData(orgUid) {
    logger.debug('acquiring add/delete org mutex to delete organization');
    const releaseAddDeleteMutex =
      await addOrDeleteOrganizationRecordMutex.acquire();

    logger.debug(
      'acquiring processingSyncRegistriesTransaction mutex to delete organization',
    );
    const releaseAuditTransactionMutex =
      await processingSyncRegistriesTransactionMutex.acquire();

    const transaction = await sequelize.transaction();
    try {
      await Organization.destroy({ where: { orgUid }, transaction });

      for (const modelKey of Object.keys(ModelKeys)) {
        await ModelKeys[modelKey].destroy({ where: { orgUid }, transaction });
      }

      await Staging.truncate({ transaction });
      await FileStore.destroy({ where: { orgUid }, transaction });
      await Audit.destroy({ where: { orgUid }, transaction });

      await transaction.commit();

      await Meta.addUserDeletedOrgUid(orgUid);
    } catch (error) {
      logger.error(
        `failed to delete all db records for organization ${orgUid}, rolling back changes. Error: ${error.message}`,
      );
      await transaction.rollback();
      throw new Error(
        `an error occurred while deleting records corresponding to organization ${orgUid}. no changes have been made`,
      );
    } finally {
      releaseAddDeleteMutex();
      releaseAuditTransactionMutex();
    }
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
                ..._.omit(updateData, [
                  'registryId',
                  'dataModelVersionStoreId',
                ]),
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

  static async editOrgMeta({ name, icon, prefix }) {
    const myOrganization = await Organization.getHomeOrg();
    const payload = {};

    if (name) {
      payload.name = name;
    }

    if (icon) {
      payload.icon = icon;
    }

    if (prefix) {
      payload.prefix = prefix;
    }

    await datalayer.upsertDataLayer(myOrganization.orgUid, payload);
  }

  static async addMetadata(payload) {
    // These first 3 steps update the datalayer as normal
    const myOrganization = await Organization.getHomeOrg();

    const metadataForDatalayer = _.mapKeys(
      payload,
      (_value, key) => `meta_${key}`,
    );

    await datalayer.upsertDataLayer(
      myOrganization.orgUid,
      metadataForDatalayer,
    );

    // These next steps update the metadata column in the database
    // Normally we would just update the datalayer and let the sync process
    // update the database, but we want to update the database immediately

    const existingOrganization = await Organization.findOne({
      attributes: ['metadata'],
      where: { orgUid: myOrganization.orgUid },
      raw: true,
    });

    const existingMetadata = JSON.parse(existingOrganization.metadata || '{}');

    // Prefix keys with "meta_" in the payload for the database update
    const payloadForDatabase = _.mapKeys(
      payload,
      (_value, key) => `meta_${key}`,
    );

    // Merge the existing metadata with the new payload
    const updatedMetadata = { ...existingMetadata, ...payloadForDatabase };

    // Convert the updated metadata back to JSON string
    const updatedMetadataJson = JSON.stringify(updatedMetadata);

    // Update the metadata column in the database
    await Organization.update(
      { metadata: updatedMetadataJson },
      { where: { orgUid: myOrganization.orgUid } },
    );
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
