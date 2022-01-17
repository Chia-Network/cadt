'use strict';

import _ from 'lodash';

import { Organization, Unit, Project, Staging } from '../models';
import { transformSerialNumberBlock } from '../utils/helpers';

export const assertCsvFileInRequest = (req) => {
  if (!_.get(req, 'files.csv')) {
    throw new Error('Can not file the required csv file in request');
  }

  return req.files.csv;
};

export const assertOrgIsHomeOrg = async (orgUid) => {
  const homeOrg = await Organization.getHomeOrg();
  if (!homeOrg[orgUid]) {
    throw new Error(
      `Restricted data: can not modify this record with orgUid ${orgUid}`,
    );
  }

  return orgUid;
};

export const assertUnitRecordExists = async (warehouseUnitId) => {
  const record = await Unit.findByPk(warehouseUnitId);
  if (!record) {
    throw new Error(
      `The unit record for the warehouseUnitId: ${warehouseUnitId} does not exist.`,
    );
  }

  return record.dataValues;
};

export const assertStagingRecordExists = async (stagingId) => {
  const record = await Staging.findByPk(stagingId);
  if (!record) {
    throw new Error(
      `The staging record for the staging ID: ${stagingId} does not exist.`,
    );
  }

  return record.dataValues;
};

export const assertProjectRecordExists = async (warehouseProjectId) => {
  const record = await Project.findByPk(warehouseProjectId);
  if (!record) {
    throw new Error(
      `The project record for the warehouseProjectId: ${warehouseProjectId} does not exist.`,
    );
  }

  return record.dataValues;
};

export const assertSumOfSplitUnitsIsValid = (
  serialNumberBlock,
  splitRecords,
) => {
  const sumOfSplitUnits = splitRecords.reduce(
    (previousValue, currentValue) =>
      previousValue.unitCount + currentValue.unitCount,
  );

  const [unitBlockStart, unitBlockEnd, unitCount] =
    transformSerialNumberBlock(serialNumberBlock);

  if (sumOfSplitUnits !== unitCount) {
    throw new Error(
      `The sum of the split units is ${sumOfSplitUnits} and the original record is ${unitCount}. These should be the same.`,
    );
  }

  return {
    unitBlockStart,
    unitBlockEnd,
    unitCount,
  };
};
