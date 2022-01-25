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

  // Extract out the orgUid thats being updated so we can
  // clean that orgs tables and repopulate without truncating
  // the entire db
  const { decodedStoreData, orgUid } = storeData.keys_values.reduce(
    (accum, kv) => {
      const decodedRecord = {
        key: new Buffer(kv.key.replace(`${storeId}_`, ''), 'hex').toString(),
        value: JSON.parse(new Buffer(kv.value, 'hex').toString()),
      };

      accum.decodedStoreData.push(decodedRecord);
      if (_.get(decodedRecord, 'value.orgUid')) {
        accum.orgUid = _.get(decodedRecord, 'value.orgUid');
      }

      return accum;
    },
    {
      decodedStoreData: [],
      orgUid: null,
    },
  );

  if (orgUid) {
    await Promise.all([
      // the child table records should cascade delete so we only need to
      // truncate the primary tables
      Unit.destroy({ where: { orgUid } }),
      Project.destroy({ where: { orgUid } }),
      QualificationUnit.destroy({ where: { orgUid } }),
    ]);
  }

  await Promise.all(
    decodedStoreData.map(async (kv) => {
      const { key, value } = kv;
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
