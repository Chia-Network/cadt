import _ from 'lodash';

import { uuid as uuidv4 } from 'uuidv4';
import csv from 'csvtojson';
import { Readable } from 'stream';

import { logger } from '../logger.js';

import { Organization, Project, Staging, Unit } from '../models';

import {
  assertOrgIsHomeOrg,
  assertProjectRecordExists,
  assertUnitRecordExists,
} from './data-assertions.js';

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
          const possibleExistingRecord = await assertProjectRecordExists(
            newRecord.warehouseProjectId,
          );

          await assertOrgIsHomeOrg(possibleExistingRecord.orgUid);
        } else {
          // When creating new project assign a uuid to is so
          // multiple organizations will always have unique ids
          newRecord.warehouseProjectId = uuidv4();
          newRecord.orgUid = (await Organization.getHomeOrg())?.orgUid;

          action = 'INSERT';
        }

        updateProjectProperties(newRecord);

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
            logging: (msg) => logger.info(msg),
            updateOnDuplicate: undefined, // TODO MariusD: find a solution for this
          });

          resolve();
        } else {
          reject('There were no valid records to parse');
        }
      });
  });
};

function updateProjectProperties(project) {
  if (typeof project !== 'object') return;

  updateProjectArrayProp(project, 'projectLocations');
  updateProjectArrayProp(project, 'labels');
  updateProjectArrayProp(project, 'issuances');
  updateProjectArrayProp(project, 'coBenefits');
  updateProjectArrayProp(project, 'relatedProjects');
  updateProjectArrayProp(project, 'projectRatings');
  updateProjectArrayProp(project, 'estimations');
}

function updateProjectArrayProp(project, propName) {
  if (
    project == null ||
    !Object.prototype.hasOwnProperty.call(project, propName) ||
    project[propName] == null
  )
    return;

  project[propName] = JSON.parse(project[propName]);
  if (Array.isArray(project[propName])) {
    project[propName].forEach((item) => {
      item.warehouseProjectId = project.warehouseProjectId;
    });
  }
}
