import { Meta, Organization } from '../models';
import * as dataLayer from './persistance';
import * as simulator from './simulatorV2';

const strToHex = (str) => {
  return new Buffer(str).toString('hex');
};

const createChangeObject = (type, key, value) => {
  return { action: type, key: strToHex(key), value: strToHex(value) };
};

const ensureDataLayerStore = async (metaKey) => {
  const storeMeta = await Meta.findOne({
    where: { metaKey },
  });

  if (!storeMeta) {
    let storeId;
    if (process.env.USE_SIMULATOR === 'true') {
      storeId = await simulator.createDataLayerStore();
    } else {
      storeId = await dataLayer.createDataLayerStore();
    }

    await Meta.create({ metaKey, metaValue: storeId });
    return storeId;
  }

  return storeMeta.metaValue;
};

const ensureRegistryStore = async (orgUid) => {
  const storeId = await ensureDataLayerStore(`registryId`);
  const changeList = [createChangeObject('insert', 'registryId', storeId)];

  if (process.env.USE_SIMULATOR === 'true') {
    await simulator.pushChangeListToDataLayer(orgUid, changeList);
  } else {
    await dataLayer.pushChangeListToDataLayer(orgUid, changeList);
  }

  return storeId;
};

const ensureRegistryTableStore = async (tableName) => {
  const myOrganization = await Organization.findOne({
    where: { isHome: true },
    raw: true,
  });

  const orgUid = myOrganization.orgUid;
  const registryId = await ensureRegistryStore(orgUid);
  const metaKey = `${tableName}TableStoreId`;
  const storeId = await ensureDataLayerStore(metaKey);
  const changeList = [createChangeObject('insert', metaKey, storeId)];

  if (process.env.USE_SIMULATOR === 'true') {
    await simulator.pushChangeListToDataLayer(registryId, changeList);
  } else {
    await dataLayer.pushChangeListToDataLayer(registryId, changeList);
  }

  return storeId;
};

export const pushChangeListToRegistryTable = async (tableName, changeList) => {
  const storeId = await ensureRegistryTableStore(tableName);

  if (storeId) {
    if (process.env.USE_SIMULATOR === 'true') {
      return simulator.pushChangeListToDataLayer(storeId, changeList);
    } else {
      return dataLayer.pushChangeListToDataLayer(storeId, changeList);
    }
  }

  throw new Error('Could not create datalayer store');
};

export const updateOrganization = async (orgName, orgIconUrl, orgWebSite) => {
  const orgUid = await ensureDataLayerStore();

  const changeList = [];
  const metaUpdateList = [];
  if (orgName) {
    changeList.push[createChangeObject('insert', 'name', orgName)];
    metaUpdateList.push({ metaKey: 'organizationName', metaValue: orgName });
  }

  if (orgIconUrl) {
    changeList.push[createChangeObject('insert', 'iconUrl', orgIconUrl)];
    metaUpdateList.push({
      metaKey: 'organizationIconUrl',
      metaValue: orgIconUrl,
    });
  }

  if (orgWebSite) {
    changeList.push[createChangeObject('insert', 'website', orgWebSite)];
    metaUpdateList.push({
      metaKey: 'organizationWebsite',
      metaValue: orgWebSite,
    });
  }

  await Meta.bulkCreate(metaUpdateList);

  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.pushChangeListToDataLayer(orgUid, changeList);
  } else {
    return dataLayer.pushChangeListToDataLayer(orgUid, changeList);
  }
};
