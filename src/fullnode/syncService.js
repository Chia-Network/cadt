import _ from 'lodash';
import logUpdate from 'log-update';

import {
  Organization,
  Unit,
  Project,
  RelatedProject,
  Label,
  Issuance,
  CoBenefit,
  ProjectLocation,
  LabelUnit,
  Staging,
  Rating,
  Estimation,
} from '../models';

import * as dataLayer from './persistance';
import * as simulator from './simulator';

export const POLLING_INTERVAL = 5000;
const frames = ['-', '\\', '|', '/'];

console.log('Start Datalayer Update Polling');
export const startDataLayerUpdatePolling = async () => {
  const tablesToUpdate = await dataLayerWasUpdated();
  await Promise.all(
    _.keys(tablesToUpdate).map(async (storeId) => {
      if (tablesToUpdate[storeId]) {
        logUpdate(
          `Updates found syncing storeId: ${storeId} ${
            frames[Math.floor(Math.random() * 3)]
          }`,
        );
        await syncDataLayerStoreToClimateWarehouse(storeId);
      } else {
        logUpdate(
          `No updates found yet ${frames[Math.floor(Math.random() * 3)]}`,
        );
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
    raw: true,
  });

  try {
    // Create a transaction for both the main db and the mirror db
    //await sequelize.transaction(async () => {
    //  return sequelizeMirror.transaction(async () => {
    if (organizationToTrucate) {
      await Promise.all([
        // the child table records should cascade delete so we only need to
        // truncate the primary tables
        Unit.destroy({ where: { orgUid: organizationToTrucate.orgUid } }),
        Project.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
        LabelUnit.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
        RelatedProject.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
        CoBenefit.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
        Issuance.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
        Label.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
        Rating.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
        ProjectLocation.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
        Estimation.destroy({
          where: { orgUid: organizationToTrucate.orgUid },
        }),
      ]);
    }

    await Promise.all(
      storeData.keys_values.map(async (kv) => {
        const key = Buffer.from(
          kv.key.replace(`${storeId}_`, ''),
          'hex',
        ).toString();
        const model = key.split('|')[0];
        const value = JSON.parse(Buffer.from(kv.value, 'hex').toString());

        if (model === 'unit') {
          await Unit.upsert(value);
          await Staging.destroy({
            where: { uuid: value.warehouseUnitId },
          });
        } else if (model === 'project') {
          await Project.upsert(value);
          await Staging.destroy({
            where: { uuid: value.warehouseProjectId },
          });
        } else if (model === 'relatedProjects') {
          await RelatedProject.upsert(value);
        } else if (model === 'label_units') {
          await LabelUnit.upsert(value);
        } else if (model === 'coBenefits') {
          await CoBenefit.upsert(value);
        } else if (model === 'issuances' || model === 'issuance') {
          await Issuance.upsert(value);
        } else if (model === 'projectLocations') {
          await ProjectLocation.upsert(value);
        } else if (model === 'labels') {
          await Label.upsert(value);
        } else if (model === 'projectRatings') {
          await Rating.upsert(value);
        } else if (model === 'estimations') {
          await Estimation.upsert(value);
        }
      }),
    );

    // clean up any staging records than involved delete commands,
    // since we cant track that they came in through the uuid,
    // we can infer this because diff.original is null instead of empty object.
    await Staging.cleanUpCommitedAndInvalidRecords();
    //  });
    //  });
  } catch (error) {
    console.trace('ERROR DURING SYNC TRANSACTION', error);
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
