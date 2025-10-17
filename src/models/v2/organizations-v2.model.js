import { Model } from 'sequelize';
import _ from 'lodash';
import { sequelizeV2 as getSequelizeV2 } from '../../database/v2/index.js';
import datalayer from '../../datalayer';
import { logger } from '../../config/logger.js';
import { AuditV2 } from './audit-v2.model.js';
import { MetaV2 } from './meta-v2.model.js';
import { StagingV2 } from './staging-v2.model.js';
import { getDataModelVersion } from '../../utils/helpers.js';
import { getConfig } from '../../utils/config-loader.js';
import { getV2Config } from '../../utils/v2-config-loader.js';

const { USE_SIMULATOR, AUTO_SUBSCRIBE_FILESTORE } = getConfig().APP;

import ModelTypes from './organizations-v2.modeltypes.cjs';
import { assertStoreIsOwned } from '../../utils/data-assertions.js';
import {
  getRoot,
  getSubscriptions,
  getSyncStatus,
} from '../../datalayer/persistance.js';

class OrganizationsV2 extends Model {
  static async getHomeOrg(includeAddress = true) {
    const myOrganization = await OrganizationsV2.findOne({
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
      const pendingCommitsCount = await StagingV2.count({
        where: { commited: true },
      });

      myOrganization.synced =
        myOrganization.synced === 1 && pendingCommitsCount === 0;
    }

    return myOrganization;
  }

  static async createHomeOrganization(name, icon, dataVersion = 'v2') {
    try {
      logger.info('Creating New V2 Organization, This could take a while.');
      const myOrganization = await OrganizationsV2.getHomeOrg();

      if (myOrganization) {
        return myOrganization.orgUid;
      }

      await OrganizationsV2.create({
        orgUid: 'PENDING',
        registryId: null,
        dataModelVersionStoreId: null,
        v2RegistryId: null,
        isHome: true,
        subscribed: false,
        name: '',
        icon: '',
      });

      logger.verbose('createHomeOrg() is creating V2 organization (orgUid) store');
      const newOrganizationId = USE_SIMULATOR
        ? 'f1c54511-865e-4611-976c-7c3c1f704662'
        : await datalayer.createDataLayerStore();

      logger.verbose('createHomeOrg() is creating V2 registryId store');
      const registryStoreId = await datalayer.createDataLayerStore();

      logger.verbose('createHomeOrg() is creating V2 dataModelVersionId store');
      const dataModelVersionStoreId = await datalayer.createDataLayerStore();

      logger.verbose('createHomeOrg() is creating V2 file store');
      const fileStoreId = await datalayer.createDataLayerStore();

      const revertOrganizationIfFailed = async () => {
        logger.error(
          'create V2 organization process failed. removing failed home organization records. please try again',
        );
        await Promise.all([
          OrganizationsV2.destroy({ where: { orgUid: newOrganizationId } }),
          OrganizationsV2.destroy({ where: { orgUid: 'PENDING' } }),
        ]);
      };

      if (!USE_SIMULATOR) {
        logger.info(
          'create V2 organization process is waiting for all store creations to confirm on the blockchain',
        );
        await new Promise((resolve) => setTimeout(() => resolve(), 30000));
        await datalayer.waitForAllTransactionsToConfirm();
      }

      logger.verbose(
        `the blockchain reported new V2 organization stores orgUid: ${newOrganizationId}, registryId: ${registryStoreId}, dataModelVersionStoreId: ${dataModelVersionStoreId}, fileStoreId: ${fileStoreId}`,
      );

      // Create V2-specific data model version store structure
      const dataModelVersionStoreData = {
        v1: registryStoreId, // V1 registry store (for backward compatibility)
        v2: registryStoreId, // V2 registry store (separate from V1)
      };

      logger.verbose('createHomeOrg() is writing to dataModelVersionStoreId');
      await datalayer.upsertDataLayer(dataModelVersionStoreId, dataModelVersionStoreData);

      logger.verbose('createHomeOrg() is writing to orgUid store');
      await datalayer.upsertDataLayer(newOrganizationId, {
        name: name || 'My Organization',
        icon: icon || '',
        dataModelVersionStoreId,
        fileStoreId,
      });

      logger.verbose('createHomeOrg() is updating organization record');
      await OrganizationsV2.update(
        {
          orgUid: newOrganizationId,
          registryId: registryStoreId,
          dataModelVersionStoreId,
          v2RegistryId: registryStoreId, // V2-specific registry
          fileStoreId,
          name: name || 'My Organization',
          icon: icon || '',
        },
        { where: { orgUid: 'PENDING' } },
      );

      logger.info(`V2 Organization created successfully with orgUid: ${newOrganizationId}`);
      return newOrganizationId;
    } catch (error) {
      logger.error('Error creating V2 home organization:', error);
      throw error;
    }
  }

  static async subscribeToOrganization(orgUid) {
    if (orgUid === 'PENDING') {
      throw new Error('Cannot subscribe to PENDING organization');
    }

    const organization = await OrganizationsV2.findOne({
      where: { orgUid },
      raw: true,
    });

    if (!organization) {
      throw new Error(`Organization ${orgUid} not found`);
    }

    if (organization.subscribed) {
      logger.info(`Organization ${orgUid} is already subscribed`);
      return {
        orgUid,
        dataModelVersionStoreId: organization.dataModelVersionStoreId,
        registryStoreId: organization.registryId,
        v2RegistryId: organization.v2RegistryId,
      };
    }

    const { dataModelVersionStoreId } = organization;

    if (!dataModelVersionStoreId) {
      throw new Error(`Organization ${orgUid} has no dataModelVersionStoreId`);
    }

    logger.debug(`subscribing to dataModelVersionStoreId ${dataModelVersionStoreId} for org ${orgUid}`);
    const subscribedToDataModelVersionStore =
      await datalayer.subscribeToStoreOnDataLayer(dataModelVersionStoreId);
    if (!subscribedToDataModelVersionStore) {
      throw new Error(
        `failed to subscribe to or validate subscription for dataModelVersionStore ${dataModelVersionStoreId}`,
      );
    }

    let dataModelVersionStoreData = null;
    while (!dataModelVersionStoreData) {
      try {
        dataModelVersionStoreData = await datalayer.getSubscribedStoreData(
          dataModelVersionStoreId,
          undefined,
          true,
        );
      } catch (error) {
        logger.debug(`${error.message}. RETRYING`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    // Get both V1 and V2 registry store IDs
    const v1RegistryStoreId = dataModelVersionStoreData?.v1;
    const v2RegistryStoreId = dataModelVersionStoreData?.v2;

    if (!v1RegistryStoreId || !v2RegistryStoreId) {
      throw new Error(
        `failed to get registry singleton ids from datamodel version singleton store ${dataModelVersionStoreId}. rpc function returned: ${dataModelVersionStoreData}`,
      );
    }

    logger.debug(
      `the registry singleton ids for organization ${orgUid} are v1: ${v1RegistryStoreId}, v2: ${v2RegistryStoreId}`,
    );

    // Subscribe to V1 registry store
    logger.debug(`checking V1 registry store singleton for org ${orgUid}`);
    const subscribedToV1RegistryStore =
      await datalayer.subscribeToStoreOnDataLayer(v1RegistryStoreId);
    if (!subscribedToV1RegistryStore) {
      throw new Error(
        `failed to subscribe to or validate subscription for V1 registry store ${v1RegistryStoreId}`,
      );
    }

    // Subscribe to V2 registry store
    logger.debug(`checking V2 registry store singleton for org ${orgUid}`);
    const subscribedToV2RegistryStore =
      await datalayer.subscribeToStoreOnDataLayer(v2RegistryStoreId);
    if (!subscribedToV2RegistryStore) {
      throw new Error(
        `failed to subscribe to or validate subscription for V2 registry store ${v2RegistryStoreId}`,
      );
    }

    // Update organization record with V2 registry info
    await OrganizationsV2.update(
      {
        v2RegistryId: v2RegistryStoreId,
        subscribed: true,
      },
      { where: { orgUid } }
    );

    logger.info(`V2 Organization ${orgUid} subscribed successfully`);
    return {
      orgUid,
      dataModelVersionStoreId,
      registryStoreId: v1RegistryStoreId,
      v2RegistryId: v2RegistryStoreId,
    };
  }
}

OrganizationsV2.init(ModelTypes, {
  sequelize: getSequelizeV2(),
  modelName: 'organizations',
  tableName: 'organizations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true,
  timezone: '+00:00',
  useHooks: true,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  },
  dialectOptions: {
    charset: 'utf8mb4',
    dateStrings: true,
    typeCast: true,
  },
});

export { OrganizationsV2 };
