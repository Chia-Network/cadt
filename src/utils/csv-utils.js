import _ from 'lodash';

import { uuid as uuidv4 } from 'uuidv4';
import csv from 'csvtojson';
import { Readable } from 'stream';

import { Staging, Organization, Unit, Project } from '../models';

import {
  assertOrgIsHomeOrg,
  assertUnitRecordExists,
  assertOrgUidIsValid,
} from '../utils/data-assertions';

export const createUnitRecordsFromCsv = (csvFile) => {
  const buffer = csvFile.data;
  const stream = Readable.from(buffer.toString('utf8'));

  const recordsToCreate = [];

  return new Promise((resolve, reject) => {
    csv()
      .fromStream(stream)
      .subscribe(async (newRecord) => {
        let action = 'UPDATE';

        const orgUid = _.head(Object.keys(await Organization.getHomeOrg()));

        if (newRecord.warehouseUnitId) {
          // Fail if they supplied their own warehouseUnitId and it doesnt exist
          const possibleExistingRecord = await assertUnitRecordExists(
            newRecord.warehouseUnitId,
          );

          await assertOrgIsHomeOrg(possibleExistingRecord.dataValues.orgUid);
        } else {
          // When creating new unitd assign a uuid to is so
          // multiple organizations will always have unique ids
          const uuid = uuidv4();
          newRecord.warehouseUnitId = uuid;
          newRecord.orgUid = orgUid;

          action = 'INSERT';
        }

        // All new records are owned by this org, but give them a chance to override this
        if (newRecord.unitOwnerOrgUid) {
          await assertOrgUidIsValid(
            newRecord.unitOwnerOrgUid,
            'unitOwnerOrgUid',
          );
        } else {
          newRecord.unitOwnerOrgUid = orgUid;
        }

        const stagedData = {
          uuid: newRecord.warehouseUnitId,
          action: action,
          table: Unit.stagingTableName,
          data: JSON.stringify([newRecord]),
        };

        recordsToCreate.push(stagedData);
      })
      .on('error', (error) => {
        reject(error);
      })
      .on('done', async () => {
        if (recordsToCreate.length) {
          await Staging.bulkCreate(recordsToCreate, {
            updateOnDuplicate: ['warehouseUnitId'],
          });

          resolve();
        } else {
          reject('There were no valid records to parse');
        }
      });
  });
};

export const createProjectRecordsFromCsv = (csvFile) => {
  const buffer = csvFile.data;
  const stream = Readable.from(buffer.toString('utf8'));

  const recordsToCreate = [];

  return new Promise((resolve, reject) => {
    csv()
      .fromStream(stream)
      .subscribe(async (newRecord) => {
        let action = 'UPDATE';

        if (newRecord.warehouseProjectId) {
          // Fail if they supplied their own warehouseUnitId and it doesnt exist
          const possibleExistingRecord = await assertUnitRecordExists(
            newRecord.warehouseProjectId,
          );

          await assertOrgIsHomeOrg(possibleExistingRecord.dataValues.orgUid);
        } else {
          // When creating new unitd assign a uuid to is so
          // multiple organizations will always have unique ids
          const uuid = uuidv4();
          newRecord.warehouseProjectId = uuid;

          const orgUid = _.head(Object.keys(await Organization.getHomeOrg()));
          newRecord.orgUid = orgUid;

          action = 'INSERT';
        }

        const stagedData = {
          uuid: newRecord.warehouseProjectId,
          action: action,
          table: Project.stagingTableName,
          data: JSON.stringify([newRecord]),
        };

        recordsToCreate.push(stagedData);
      })
      .on('error', (error) => {
        reject(error);
      })
      .on('done', async () => {
        if (recordsToCreate.length) {
          await Staging.bulkCreate(recordsToCreate, {
            updateOnDuplicate: ['warehouseProjectId'],
          });

          resolve();
        } else {
          reject('There were no valid records to parse');
        }
      });
  });
};
