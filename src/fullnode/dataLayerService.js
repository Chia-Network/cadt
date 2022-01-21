import { Meta } from '../models';
import * as dataLayer from './persistance';
import * as simulator from './simulatorV2';

const strToHex = (str) => {
  console.log('str', str);
  return new Buffer(str).toString('hex');
};

const createChangeObject = (type, key, value) => {
  console.log(type, key, value);
  return { action: type, key: strToHex(key), value: strToHex(value) };
};

const ensureDataLayerStore = async (metaKey) => {
  const storeMeta = await Meta.findOne({
    where: { metaKey },
  });

  console.log('@@@', storeMeta);

  if (!storeMeta) {
    let storeId;
    if (process.env.USE_SIMULATOR === 'true') {
      storeId = await simulator.createDataLayerStore();
    } else {
      storeId = await dataLayer.createDataLayerStore();
    }

    console.log({ [metaKey]: storeId });

    await Meta.create({ [metaKey]: storeId });
    return storeId;
  }

  return storeMeta.metaValue;
};

const ensureRegistryStore = async (orgUid) => {
  const storeId = await ensureDataLayerStore('registryId');
  const changeList = [createChangeObject('insert', 'registryId', storeId)];

  console.log('#####orgUid', orgUid, changeList);

  let registryId;
  if (process.env.USE_SIMULATOR === 'true') {
    registryId = await simulator.pushChangeListToDataLayer(orgUid, changeList);
  } else {
    registryId = await dataLayer.pushChangeListToDataLayer(orgUid, changeList);
  }
  await Meta.create({ registryId });
  return registryId;
};

const ensureRegistryTableStore = async (tableName) => {
  const orgUid = await ensureOrganizationStore();
  const registryId = await ensureRegistryStore(orgUid);
  const metaKey = `${tableName}StoreId`;
  const storeId = await ensureDataLayerStore(metaKey);
  const changeList = [createChangeObject('insert', metaKey, storeId)];

  let registryTableStoreId;
  if (process.env.USE_SIMULATOR === 'true') {
    registryTableStoreId = await simulator.pushChangeListToDataLayer(
      registryId,
      changeList,
    );
  } else {
    registryTableStoreId = await dataLayer.pushChangeListToDataLayer(
      registryId,
      changeList,
    );
  }

  await Meta.create({ [metaKey]: registryTableStoreId });

  console.log('3############', registryTableStoreId);
  return registryTableStoreId;
};

const ensureOrganizationStore = async () => {
  const metaKey = 'organizationId';
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

    await Meta.upsert({ metaKey: 'organizationId', metaValue: storeId });
    return storeId;
  }

  return storeMeta.metaValue;
};

export const pushChangeListToRegistryTable = async (tableName, changeList) => {
  const storeId = await ensureRegistryTableStore(tableName);

  console.log('########', storeId);

  if (storeId) {
    if (process.env.USE_SIMULATOR === 'true') {
      return simulator.pushChangeListToDataLayer(storeId, changeList);
    } else {
      return dataLayer.pushChangeListToDataLayer(storeId, changeList);
    }
  }

  throw new Error('Could not create datalayer store');
};

export const getRegistryTableData = async (tableName) => {
  const storeId = await ensureDataLayerStore(tableName);

  if (process.env.USE_SIMULATOR === 'true') {
    return simulator.getStoreData(storeId);
  } else {
    return dataLayer.getStoreData(storeId);
  }
};

export const updateOrganization = async (orgName, orgIconUrl, orgWebSite) => {
  const orgUid = await ensureOrganizationStore();

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
