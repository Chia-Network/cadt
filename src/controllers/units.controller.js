'use strict';

import _ from 'lodash';

import { uuid as uuidv4 } from 'uuidv4';

import { Staging, Unit, Qualification, Vintage, Organization } from '../models';

import {
  columnsToInclude,
  optionallyPaginatedResponse,
  paginationParams,
  createSerialNumberStr,
} from '../utils/helpers';

import {
  assertOrgIsHomeOrg,
  assertUnitRecordExists,
  assertSumOfSplitUnitsIsValid,
  assertCsvFileInRequest,
} from '../utils/data-assertions';

import { createUnitRecordsFromCsv } from '../utils/csv-utils';

export const create = async (req, res) => {
  try {
    const newRecord = _.cloneDeep(req.body);

    // When creating new unitd assign a uuid to is so
    // multiple organizations will always have unique ids
    const uuid = uuidv4();

    newRecord.warehouseUnitId = uuid;

    // All new units are assigned to the home orgUid
    const orgUid = _.head(Object.keys(await Organization.getHomeOrg()));
    newRecord.orgUid = orgUid;
    newRecord.unitOwnerOrgUid = orgUid;

    const stagedData = {
      uuid,
      action: 'INSERT',
      table: Unit.stagingTableName,
      data: JSON.stringify([newRecord]),
    };

    await Staging.create(stagedData);

    res.json({
      message: 'Unit created successfully',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
    });
  }
};

export const findAll = async (req, res) => {
  let { page, limit, columns, orgUid, search } = req.query;
  let where = orgUid ? { orgUid } : undefined;

  const includes = [Qualification];

  if (columns) {
    // Remove any unsupported columns
    columns = columns.filter((col) =>
      Unit.defaultColumns
        .concat(includes.map((model) => model.name + 's'))
        .includes(col),
    );
  } else {
    columns = Unit.defaultColumns;
  }

  // If only FK fields have been specified, select just ID
  if (!columns.length) {
    columns = ['warehouseUnitId'];
  }

  let results;

  if (search) {
    results = await Unit.fts(
      search,
      orgUid,
      paginationParams(page, limit),
      columns,
    );
  }

  if (!results) {
    results = await Unit.findAndCountAll({
      where,
      distinct: true,
      ...columnsToInclude(columns, includes),
      ...paginationParams(page, limit),
    });
  }

  res.json(optionallyPaginatedResponse(results, page, limit));
};

export const findOne = async (req, res) => {
  console.info('req.query', req.query);
  res.json(
    await Unit.findByPk(req.query.warehouseUnitId, {
      include: [
        {
          model: Qualification,
          as: 'qualifications',
        },
        Vintage,
      ],
    }),
  );
};

export const update = async (req, res) => {
  try {
    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    assertOrgIsHomeOrg(res, originalRecord.orgUid);

    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'UPDATE',
      table: Unit.stagingTableName,
      data: JSON.stringify(Array.isArray(req.body) ? req.body : [req.body]),
    };

    await Staging.upsert(stagedData);

    res.json({
      message: 'Unit updated successfully',
    });
  } catch (err) {
    res.status(400).json({
      message: 'Error updating new unit',
      error: err.message,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    assertOrgIsHomeOrg(res, originalRecord.orgUid);

    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'DELETE',
      table: Unit.stagingTableName,
    };

    await Staging.upsert(stagedData);
    res.json({
      message: 'Unit deleted successfully',
    });
  } catch (err) {
    res.status(400).json({
      message: 'Error deleting new unit',
      error: err.message,
    });
  }
};

export const split = async (req, res) => {
  try {
    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    // we dont need these fields for split
    delete originalRecord.createdAt;
    delete originalRecord.updatedAt;

    assertOrgIsHomeOrg(res, originalRecord.orgUid);

    const { unitBlockStart } = assertSumOfSplitUnitsIsValid(
      originalRecord.serialNumberBlock,
      req.body.records,
    );

    let lastAvailableUnitBlock = unitBlockStart;

    const splitRecords = req.body.records.map((record) => {
      const newRecord = _.cloneDeep(originalRecord);
      newRecord.warehouseUnitId = uuidv4();
      newRecord.unitCount = record.unitCount;

      const newUnitBlockStart = lastAvailableUnitBlock;
      lastAvailableUnitBlock += Number(record.unitCount);
      const newUnitBlockEnd = lastAvailableUnitBlock;
      // move to the next available block
      lastAvailableUnitBlock += 1;

      newRecord.serialNumberBlock = createSerialNumberStr(
        originalRecord.serialNumberBlock,
        newUnitBlockStart,
        newUnitBlockEnd,
      );

      if (record.unitOwnerOrgUid) {
        newRecord.unitOwnerOrgUid = record.unitOwnerOrgUid;
      }

      return newRecord;
    });

    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'UPDATE',
      commited: false,
      table: Unit.stagingTableName,
      data: JSON.stringify(splitRecords),
    };

    await Staging.upsert(stagedData);

    res.json({
      message: 'Unit split successful',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error splitting unit',
      error: error.message,
    });
  }
};

export const batchUpload = async (req, res) => {
  try {
    const csvFile = await assertCsvFileInRequest(req);
    await createUnitRecordsFromCsv(csvFile);

    res.json({
      message:
        'CSV processing complete, your records have been added to the staging table.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
    });
  }
};
