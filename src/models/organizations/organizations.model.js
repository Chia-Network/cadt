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
    const organizations = Organization.findOne({
      attributes: ['orgUid', 'name', 'icon', 'isHome', 'subscribed'],
      raw: true,
    });

    return organizations.reduce((map, current) => {
      if (map) {
        map = {};
      }

      map[current.orgUid] = current;
    });
  }

  static async createHomeOrganization(name, icon, dataVersion = 'v1') {
    const myOrganization = await Organization.getHomeOrg();

    if (myOrganization) {
      return myOrganization.orgUid;
    }

    const newOrganizationId = await createDataLayerStore();
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

    // Create the TableStores
    const coBenefitsStoreId = await createDataLayerStore();
    const projectLocationStoreId = await createDataLayerStore();
    const projectsStoreId = await createDataLayerStore();
    const projectRatingStoreId = await createDataLayerStore();
    const relatedProjectsStoreId = await createDataLayerStore();
    const qualificationsStoreId = await createDataLayerStore();
    const unitsStoreId = await createDataLayerStore();
    const vintagesStoreId = await createDataLayerStore();
    const qualificationUnitJunctionStoreId = await createDataLayerStore();

    await syncDataLayer(registryVersionId, {
      coBenefitsStoreId,
      projectLocationStoreId,
      projectsStoreId,
      projectRatingStoreId,
      relatedProjectsStoreId,
      qualificationsStoreId,
      unitsStoreId,
      vintagesStoreId,
      qualificationUnitJunctionStoreId,
    });

    await Organization.create({
      orgUid: newOrganizationId,
      registryId: registryVersionId,
      coBenefitsStoreId,
      projectLocationStoreId,
      projectsStoreId,
      projectRatingStoreId,
      relatedProjectsStoreId,
      qualificationsStoreId,
      qualificationUnitJunctionStoreId,
      unitsStoreId,
      vintagesStoreId,
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
});

export { Organization };
