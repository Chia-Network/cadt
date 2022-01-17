import _ from 'lodash';

import { uuid as uuidv4 } from 'uuidv4';
import csv from 'csvtojson';
import { Readable } from 'stream';

import { Staging, Organization, Unit, Project } from '../models';

import {
  assertOrgIsHomeOrg,
  assertUnitRecordExists,
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

        if (newRecord.warehouseUnitId) {
          // Fail if they supplied their own warehouseUnitId and it doesnt exist
          const possibleExistingRecord = await assertUnitRecordExists(
            newRecord.warehouseUnitId,
          );

          assertOrgIsHomeOrg(possibleExistingRecord.dataValues.orgUid);
        } else {
          // When creating new unitd assign a uuid to is so
          // multiple organizations will always have unique ids
          const uuid = uuidv4();
          newRecord.warehouseUnitId = uuid;

          action = 'INSERT';
        }

        const orgUid = _.head(Object.keys(await Organization.getHomeOrg()));

        // All new records are registered within this org, but give them a chance to override this
        if (!newRecord.orgUid) {
          newRecord.orgUid = orgUid;
        }

        // All new records are owned by this org, but give them a chance to override this
        if (!newRecord.unitOwnerOrgUid) {
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
          await Staging.bulkCreate(recordsToCreate);

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

          assertOrgIsHomeOrg(possibleExistingRecord.dataValues.orgUid);
        } else {
          // When creating new unitd assign a uuid to is so
          // multiple organizations will always have unique ids
          const uuid = uuidv4();
          newRecord.warehouseProjectId = uuid;

          action = 'INSERT';
        }

        const orgUid = _.head(Object.keys(await Organization.getHomeOrg()));

        // All new records are registered within this org, but give them a chance to override this
        if (!newRecord.orgUid) {
          newRecord.orgUid = orgUid;
        }

        const stagedData = {
          uuid: newRecord.warehouseUnitId,
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
          await Staging.bulkCreate(recordsToCreate);

          resolve();
        } else {
          reject('There were no valid records to parse');
        }
      });
  });
};
