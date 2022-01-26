import _ from 'lodash';

import {
  Organization,
  Unit,
  Project,
  RelatedProject,
  Qualification,
  Issuance,
  CoBenefit,
  ProjectLocation,
  QualificationUnit,
  Staging,
} from '../models';

import { sequelize, sequelizeMirror } from '../models/database';

import * as dataLayer from './persistance';
import * as simulator from './simulator';

export const POLLING_INTERVAL = 10000;

export const startDataLayerUpdatePolling = async () => {
  console.log('Start Datalayer Update Polling');

  const tablesToUpdate = await dataLayerWasUpdated();
  await Promise.all(
    _.keys(tablesToUpdate).map(async (storeId) => {
      if (tablesToUpdate[storeId]) {
        await syncDataLayerStoreToClimateWarehouse(storeId);
      }
    }),
  );

  // after all the updates are complete, check again in a bit
  setTimeout(() => startDataLayerUpdatePolling(), POLLING_INTERVAL);
};

export const syncDataLayerStoreToClimateWarehouse = async (storeId) => {
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

  try {
    // Create a transaction for both the main db and the mirror db
    await sequelize.transaction(async () => {
      return sequelizeMirror.transaction(async () => {
        if (organizationToTrucate) {
          await Promise.all([
            // the child table records should cascade delete so we only need to
            // truncate the primary tables
            Unit.destroy({ where: { orgUid: organizationToTrucate.orgUid } }),
            Project.destroy({
              where: { orgUid: organizationToTrucate.orgUid },
            }),
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
              await Staging.destroy({
                where: { uuid: value.warehouseUnitId },
              });
            } else if (key.includes('project')) {
              await Project.upsert(value);
              await Staging.destroy({
                where: { uuid: value.warehouseProjectId },
              });
            } else if (key.includes('relatedProjects')) {
              await RelatedProject.upsert(value);
            } else if (key.includes('qualification_units')) {
              await QualificationUnit.upsert(value);
            } else if (key.includes('coBenefits')) {
              await CoBenefit.upsert(value);
            } else if (key.includes('issuances')) {
              await Issuance.upsert(value);
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
        await Staging.cleanUpCommitedAndInvalidRecords();
      });
    });
  } catch (error) {
    console.log('ERROR DURING SYNC TRANSACTION', error);
  }
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
