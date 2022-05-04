'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../../database';

import datalayer from '../../datalayer';

import { logger } from '../../config/logger.cjs';

import {
  getDefaultOrganizationList,
  serverAvailable,
} from '../../utils/data-loaders';

import { getConfig } from '../../utils/config-loader';
const { USE_SIMULATOR } = getConfig().APP;

logger.info('climate-warehouse:organizations');

import ModelTypes from './organizations.modeltypes.cjs';

class Organization extends Model {
  static async getHomeOrg(includeAddress = true) {
    const myOrganization = await Organization.findOne({
      attributes: ['orgUid', 'name', 'icon', 'subscribed', 'registryId'],
      where: { isHome: true },
      raw: true,
    });

    if (myOrganization && includeAddress) {
      myOrganization.xchAddress = await datalayer.getPublicAddress();
      return myOrganization;
    }

    return undefined;
  }

  static async getOrgsMap() {
    const organizations = await Organization.findAll({
      attributes: ['orgUid', 'name', 'icon', 'isHome', 'subscribed'],
    });

    for (let i = 0; i < organizations.length; i++) {
      if (organizations[i].dataValues.isHome) {
        organizations[i].dataValues.xchAddress =
          await datalayer.getPublicAddress();
        break;
      }
    }

    return organizations.reduce((map, current) => {
      map[current.orgUid] = current.dataValues;

      return map;
    }, {});
  }

  static async createHomeOrganization(name, icon, dataVersion = 'v1') {
    const myOrganization = await Organization.getHomeOrg();

    if (myOrganization) {
      return myOrganization.orgUid;
    }

    const newOrganizationId = USE_SIMULATOR
      ? 'f1c54511-865e-4611-976c-7c3c1f704662'
      : await datalayer.createDataLayerStore();

    const newRegistryId = await datalayer.createDataLayerStore();
    const registryVersionId = await datalayer.createDataLayerStore();

    const revertOrganizationIfFailed = async () => {
      logger.info('Reverting Failed Organization');
      await Organization.destroy({ where: { orgUid: newOrganizationId } });
    };

    // sync the organization store
    await datalayer.syncDataLayer(
      newOrganizationId,
      {
        registryId: newRegistryId,
        name,
        icon,
      },
      revertOrganizationIfFailed,
    );

    //sync the registry store
    await datalayer.syncDataLayer(
      newRegistryId,
      {
        [dataVersion]: registryVersionId,
      },
      revertOrganizationIfFailed,
    );

    await Organization.create({
      orgUid: newOrganizationId,
      registryId: registryVersionId,
      isHome: true,
      subscribed: USE_SIMULATOR,
      name,
      icon,
    });

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
  }

  // eslint-disable-next-line
  static appendNewRegistry = (dataVersion) => {
    throw new Error('Not implemented yet');
  };

  // eslint-disable-next-line
  static importOrganization = async (orgUid, ip, port) => {
    try {
      logger.info('Subscribing to', orgUid, ip, port);
      const orgData = await datalayer.getSubscribedStoreData(orgUid, ip, port);

      logger.info(orgData);

      if (!orgData.registryId) {
        throw new Error(
          'Currupted organization, no registryId on the datalayer, can not import',
        );
      }

      logger.info('IMPORTING REGISTRY: ', orgData.registryId);

      const registryData = await datalayer.getSubscribedStoreData(
        orgData.registryId,
        ip,
        port,
      );

      if (!registryData.v1) {
        throw new Error('Organization has no registry, can not import');
      }

      logger.info('IMPORTING REGISTRY V1: ', registryData.v1);

      await datalayer.subscribeToStoreOnDataLayer(registryData.v1, ip, port);

      logger.info({
        orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registryId: registryData.v1,
        subscribed: true,
        isHome: false,
      });

      await Organization.upsert({
        orgUid,
        name: orgData.name,
        icon: orgData.icon,
        registryId: registryData.v1,
        subscribed: true,
        isHome: false,
      });
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
            const updateData = data.reduce((update, current) => {
              // TODO: this needs to pull the v1 record
              if (current.key !== 'registryId') {
                update[current.key] = current.value;
              }
              return update;
            }, {});

            Organization.update(
              { ...updateData },
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
      logger.info(error);
    }
  };

  static subscribeToDefaultOrganizations = async () => {
    try {
      const defaultOrgs = await getDefaultOrganizationList();
      if (!Array.isArray(defaultOrgs)) {
        logger.info(
          'ERROR: Default Organization List Not found, This instance may be missing data from default orgs',
        );
      }

      await Promise.all(
        defaultOrgs.map(async (org) => {
          const exists = await Organization.findOne({
            where: { orgUid: org.orgUid },
          });

          if (!exists) {
            if (serverAvailable(org.ip, org.port)) {
              Organization.importOrganization(org.orgUid, org.ip, org.port);
            }
          }
        }),
      );
    } catch (error) {
      logger.info(error);
    }
  };
}

Organization.init(ModelTypes, {
  sequelize,
  modelName: 'organization',
  timestamps: true,
});

export { Organization };
