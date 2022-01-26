import _ from 'lodash';

import {
  Organization,
  Unit,
  Project,
  RelatedProject,
  Qualification,
  Vintage,
  CoBenefit,
  ProjectLocation,
  QualificationUnit,
  Staging,
} from '../models';
import * as dataLayer from './persistance';
import * as simulator from './simulator';

let updateInterval;

export const startDataLayerUpdatePolling = () => {
  console.log('Start Datalayer Update Polling');
  updateInterval = setInterval(async () => {
    const tablesToUpdate = await dataLayerWasUpdated();
    _.keys(tablesToUpdate).forEach((storeId) => {
      // if (tablesToUpdate[storeId]) {
      syncDataLayerStore(storeId);
      // }
    });
  }, 10000);
};

export const stopDataLayerUpdatePolling = () => {
  clearInterval(updateInterval);
};

export const syncDataLayerStore = async (storeId) => {
  let storeData;

  if (process.env.USE_SIMULATOR === 'true') {
    storeData = await simulator.getStoreData(storeId);
  } else {
    storeData = await dataLayer.getStoreData(storeId);
  }

  const organizationToTrucate = await Organization.findOne({
    where: { registryId: storeId },
    attributes: ['orgUid'],
  });

  if (organizationToTrucate) {
    await Promise.all([
      // the child table records should cascade delete so we only need to
      // truncate the primary tables
      Unit.destroy({ where: { orgUid: organizationToTrucate.orgUid } }),
      Project.destroy({ where: { orgUid: organizationToTrucate.orgUid } }),
      QualificationUnit.destroy({
        where: { orgUid: organizationToTrucate.orgUid },
      }),
    ]);
  }

  await Promise.all(
    storeData.keys_values.map(async (kv) => {
      const key = new Buffer(
        kv.key.replace(`${storeId}_`, ''),
        'hex',
      ).toString();
      const value = JSON.parse(new Buffer(kv.value, 'hex').toString());
      if (key.includes('unit')) {
        await Unit.upsert(value);
        await Staging.destroy({ where: { uuid: value.warehouseUnitId } });
      } else if (key.includes('project')) {
        await Project.upsert(value);
        await Staging.destroy({ where: { uuid: value.warehouseProjectId } });
      } else if (key.includes('relatedProjects')) {
        await RelatedProject.upsert(value);
      } else if (key.includes('qualification_units')) {
        await QualificationUnit.upsert(value);
      } else if (key.includes('coBenefits')) {
        await CoBenefit.upsert(value);
      } else if (key.includes('vintages')) {
        await Vintage.upsert(value);
      } else if (key.includes('projectLocations')) {
        await ProjectLocation.upsert(value);
      } else if (key.includes('qualifications')) {
        await Qualification.upsert(value);
      }
    }),
  );

  // clean up any staging records than involved delete commands,
  // since we cant track that they came in through the uuid,
  // we can infer this because diff.original is null instead of empty object.
  const stagingRecords = await Staging.findAll({ raw: true });

  const stagingRecordsToDelete = await stagingRecords.filter(async (record) => {
    const { uuid, table, action, data } = record;
    const diff = await Staging.getDiffObject(uuid, table, action, data);
    return diff.original === null;
  });

  await Staging.destroy({
    where: { uuid: stagingRecordsToDelete.map((record) => record.uuid) },
  });
};

export const dataLayerWasUpdated = async () => {
  const organizations = await Organization.findAll({
    attributes: ['registryId', 'registryHash'],
    raw: true,
  });

  let hashMap = {};

  organizations.forEach((org) => {
    hashMap[org.registryId] = org.registryHash;
  });

  let newHashes;
  if (process.env.USE_SIMULATOR === 'true') {
    newHashes = await simulator.getRoots(_.keys(hashMap));
  } else {
    newHashes = await dataLayer.getRoots(_.keys(hashMap));
  }

  const tablesWereUpdatedMap = {};
  await Promise.all(
    _.keys(hashMap).map(async (key, index) => {
      await Organization.update(
        { registryHash: newHashes.hash[index] },
        { where: { registryId: key } },
      );
      tablesWereUpdatedMap[key] = hashMap[key] !== newHashes.hash[index];
    }),
  );

  return tablesWereUpdatedMap;
};
