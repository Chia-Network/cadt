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
      if (tablesToUpdate[storeId]) {
        syncDataLayerStore(storeId);
      }
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

  await Promise.all([
    Unit.destroy({ where: {}, truncate: true }),
    Project.destroy({ where: {}, truncate: true }),
    RelatedProject.destroy({ where: {}, truncate: true }),
    QualificationUnit.destroy({ where: {}, truncate: true }),
    CoBenefit.destroy({ where: {}, truncate: true }),
    Vintage.destroy({ where: {}, truncate: true }),
    ProjectLocation.destroy({ where: {}, truncate: true }),
    Qualification.destroy({ where: {}, truncate: true }),
  ]);

  await Promise.all(
    storeData.keys_values.map(async (kv) => {
      const key = new Buffer(
        kv.key.replace(`${storeId}_`, ''),
        'hex',
      ).toString();
      const value = new Buffer(kv.value, 'hex').toString();

      if (key.includes('unit')) {
        const data = JSON.parse(value);
        await Unit.upsert(data);
        await Staging.destroy({ where: { uuid: data.warehouseUnitId } });
      } else if (key.includes('project')) {
        const data = JSON.parse(value);
        await Project.upsert(data);
        await Staging.destroy({ where: { uuid: data.warehouseProjectId } });
      } else if (key.includes('relatedProjects')) {
        await RelatedProject.upsert(JSON.parse(value));
      } else if (key.includes('qualification_units')) {
        await QualificationUnit.upsert(JSON.parse(value));
      } else if (key.includes('coBenefits')) {
        await CoBenefit.upsert(JSON.stringify(value));
      } else if (key.includes('vintages')) {
        await Vintage.upsert(JSON.parse(value));
      } else if (key.includes('projectLocations')) {
        await ProjectLocation.upsert(JSON.parse(value));
      } else if (key.includes('qualifications')) {
        await Qualification.upsert(JSON.parse(value));
      }
    }),
  );
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
