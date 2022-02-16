'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import {
  createDataLayerStore,
  syncDataLayer,
  subscribeToStoreOnDataLayer,
  getSubscribedStoreData,
} from '../../datalayer';

import ModelTypes from './organizations.modeltypes.cjs';

class Organization extends Model {
  static async getHomeOrg() {
    const myOrganization = await Organization.findOne({
      attributes: ['orgUid', 'name', 'icon'],
      where: { isHome: true },
      raw: true,
    });

    if (myOrganization) {
      return myOrganization;
    }

    return undefined;
  }

  static async getOrgsMap() {
    const organizations = await Organization.findAll({
      attributes: ['orgUid', 'name', 'icon', 'isHome', 'subscribed'],
    });

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

    const newOrganizationId =
      process.env.USE_SIMULATOR === 'true'
        ? 'f1c54511-865e-4611-976c-7c3c1f704662'
        : await createDataLayerStore();

    const newRegistryId = await createDataLayerStore();
    const registryVersionId = await createDataLayerStore();

    // sync the organization store
    await syncDataLayer(newOrganizationId, {
      registryId: newRegistryId,
      name,
      icon,
    });

    //sync the registry store
    await syncDataLayer(newRegistryId, {
      [dataVersion]: registryVersionId,
    });

    await Organization.create({
      orgUid: newOrganizationId,
      registryId: registryVersionId,
      isHome: true,
      subscribed: true,
      name,
      icon,
    });

    return newOrganizationId;
  }

  // eslint-disable-next-line
  static appendNewRegistry = (dataVersion) => {
    throw new Error('Not implemented yet');
  };

  // eslint-disable-next-line
  static importOrganization = async (orgUid, ip, port) => {
    const orgData = await getSubscribedStoreData(orgUid, ip, port);

    if (!orgData.registryId) {
      throw new Error(
        'Currupted organization, no registryId on the datalayer, can not import',
      );
    }

    console.log('IMPORTING REGISTRY: ', orgData.registryId);

    const registryData = await getSubscribedStoreData(
      orgData.registryId,
      ip,
      port,
    );

    if (!registryData.v1) {
      throw new Error('Organization has no registry, can not import');
    }

    console.log('IMPORTING REGISTRY V1: ', registryData.v1);

    await subscribeToStoreOnDataLayer(registryData.v1, ip, port);

    console.log({
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
  };

  // eslint-disable-next-line
  static subscribeToOrganization = async (orgUid) => {
    const exists = await Organization.findOne({ where: { orgUid } });
    if (exists) {
      await Organization.update({ subscribed: true }, { orgUid });
    } else {
      Organization.importOrganization(orgUid);
    }
  };

  // eslint-disable-next-line
  static unsubscribeToOrganization = async (orgUid) => {
    await Organization.update({ subscribed: false }, { orgUid });
  };
}

Organization.init(ModelTypes, {
  sequelize,
  modelName: 'organization',
  timestamps: true,
});

export { Organization };
