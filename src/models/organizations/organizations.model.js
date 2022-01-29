'use strict';

import Sequelize from 'sequelize';
const { Model } = Sequelize;
import { sequelize } from '../database';
import { createDataLayerStore, syncDataLayer } from '../../fullnode';

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
  static importHomeOrganization = (orgUid) => {
    throw new Error('Not implemented yet');
  };

  // eslint-disable-next-line
  static subscribeToOrganization = (orgUid) => {
    throw new Error('Not implemented yet');
  };

  // eslint-disable-next-line
  static unsubscribeToOrganization = (orgUid) => {
    throw new Error('Not implemented yet');
  };
}

Organization.init(ModelTypes, {
  sequelize,
  modelName: 'organization',
  timestamps: true,
});

export { Organization };
