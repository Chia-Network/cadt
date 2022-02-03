'use strict';

import _ from 'lodash';

import { Organization, Unit, Project, Staging } from '../models';
import { transformSerialNumberBlock } from '../utils/helpers';

export const assetNoPendingCommits = async () => {
  const pendingCommits = await Staging.findAll({
    where: { commited: true },
    raw: true,
  });

  if (pendingCommits.length > 0) {
    throw new Error(
      'You currently have changes pending on the blockchain. Please wait for them to propagate before making more changes',
    );
  }
};

export const assertHomeOrgExists = async () => {
  const homeOrg = await Organization.getHomeOrg();
  if (!homeOrg) {
    throw new Error(
      `No Home organization found, please create an organization to write data`,
    );
  }

  return homeOrg;
};

export const assertOrgUidIsValid = async (orgUid, fieldName) => {
  const orgMap = await Organization.getOrgsMap();
  if (!orgMap[orgUid]) {
    throw new Error(
      `The orgUid: ${orgUid}, provided for '${fieldName}' is not in the list of subscribed organizations, either remove it or add it to your organizations and try again`,
    );
  }

  return orgMap;
};

export const assertCsvFileInRequest = (req) => {
  if (!_.get(req, 'files.csv')) {
    throw new Error('Can not file the required csv file in request');
  }

  return req.files.csv;
};

export const assertOrgIsHomeOrg = async (orgUid) => {
  const homeOrg = await Organization.getHomeOrg();

  if (homeOrg.orgUid !== orgUid) {
    throw new Error(
      `Restricted data: can not modify this record with orgUid ${orgUid}`,
    );
  }

  return orgUid;
};

export const assertUnitRecordExists = async (
  warehouseUnitId,
  customMessage,
) => {
  const record = await Unit.findByPk(warehouseUnitId, {
    include: Unit.getAssociatedModels(),
  });
  if (!record) {
    throw new Error(
      customMessage ||
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

export const assertProjectRecordExists = async (
  warehouseProjectId,
  customMessage,
) => {
  const record = await Project.findByPk(warehouseProjectId, {
    include: Project.getAssociatedModels(),
  });

  if (!record) {
    throw new Error(
      customMessage ||
        `The project record for the warehouseProjectId: ${warehouseProjectId} does not exist.`,
    );
  }

  return record.dataValues;
};

export const assertSumOfSplitUnitsIsValid = (
  serialNumberBlock,
  serialNumberPattern,
  splitRecords,
) => {
  const sumOfSplitUnits = splitRecords.reduce(
    (previousValue, currentValue) =>
      previousValue.unitCount + currentValue.unitCount,
  );

  const [unitBlockStart, unitBlockEnd, unitCount] = transformSerialNumberBlock(
    serialNumberBlock,
    serialNumberPattern,
  );

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
