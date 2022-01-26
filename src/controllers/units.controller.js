'use strict';

import _ from 'lodash';
import { uuid as uuidv4 } from 'uuidv4';

import {
  Staging,
  Unit,
  Qualification,
  Issuance,
  Organization,
} from '../models';

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
  assertHomeOrgExists,
} from '../utils/data-assertions';

import { createUnitRecordsFromCsv } from '../utils/csv-utils';
import { createXlsFromSequelizeResults, sendXls } from '../utils/xls';

export const create = async (req, res) => {
  try {
    await assertHomeOrgExists();

    const newRecord = _.cloneDeep(req.body);

    // When creating new unitd assign a uuid to is so
    // multiple organizations will always have unique ids
    const uuid = uuidv4();

    newRecord.warehouseUnitId = uuid;

    // All new units are assigned to the home orgUid
    const { orgUid } = await Organization.getHomeOrg();
    newRecord.orgUid = orgUid;

    const stagedData = {
      uuid,
      action: 'INSERT',
      table: Unit.stagingTableName,
      data: JSON.stringify([newRecord]),
    };

    await Staging.create(stagedData);

    res.json({
      message: 'Unit staged successfully',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
    });
  }
};

export const findAll = async (req, res) => {
  let { page, limit, columns, orgUid, search, xls } = req.query;
  let where = orgUid ? { orgUid } : undefined;

  const includes = [Qualification, Issuance];

  if (columns) {
    // Remove any unsupported columns
    columns = columns.filter((col) =>
      Unit.defaultColumns
        .concat(includes.map((model) => model.name + 's'))
        .includes(col),
    );
  } else {
    columns = Unit.defaultColumns.concat(
      includes.map((model) => model.name + 's'),
    );
  }

  // If only FK fields have been specified, select just ID
  if (!columns.length) {
    columns = ['warehouseUnitId'];
  }

  let results;
  let pagination = paginationParams(page, limit);

  if (xls) {
    pagination = { page: undefined, limit: undefined };
  }

  if (search) {
    results = await Unit.fts(search, orgUid, pagination, Unit.defaultColumns);

    // Lazy load the associations when doing fts search, not ideal but the page sizes should be small

    if (columns.includes('qualifications')) {
      results.rows = await Promise.all(
        results.rows.map(async (result) => {
          result.dataValues.qualifications = await Qualification.findAll({
            include: [
              {
                model: Unit,
                where: {
                  warehouseUnitId: result.dataValues.warehouseUnitId,
                },
                attributes: [],
                as: 'unit',
                require: true,
              },
            ],
          });
          return result;
        }),
      );
    }

    if (columns.includes('issuances')) {
      results.rows = await Promise.all(
        results.rows.map(async (result) => {
          result.dataValues.issuance = await Issuance.findByPk(
            result.dataValues.issuanceId,
          );
          return result;
        }),
      );
    }
  }

  if (!results) {
    results = await Unit.findAndCountAll({
      where,
      distinct: true,
      ...columnsToInclude(columns, includes),
      ...paginationParams(page, limit),
    });
  }

  const response = optionallyPaginatedResponse(results, page, limit);

  if (!xls) {
    return res.json(response);
  } else {
    return sendXls(
      Unit.name,
      createXlsFromSequelizeResults(response, Unit),
      res,
    );
  }
};

export const findOne = async (req, res) => {
  console.info('req.query', req.query);
  res.json(
    await Unit.findByPk(req.query.warehouseUnitId, {
      include: Unit.getAssociatedModels(),
    }),
  );
};

export const update = async (req, res) => {
  try {
    await assertHomeOrgExists();

    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

    // merge the new record into the old record
    let stagedRecord = Array.isArray(req.body) ? req.body : [req.body];
    stagedRecord = stagedRecord.map((record) =>
      Object.assign({}, originalRecord, record),
    );

    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'UPDATE',
      table: Unit.stagingTableName,
      data: JSON.stringify(stagedRecord),
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
    await assertHomeOrgExists();

    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

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
    await assertHomeOrgExists();

    const originalRecord = await assertUnitRecordExists(
      req.body.warehouseUnitId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

    const { unitBlockStart } = assertSumOfSplitUnitsIsValid(
      originalRecord.serialNumberBlock,
      new RegExp(originalRecord.serialNumberPattern),
      req.body.records,
    );

    let lastAvailableUnitBlock = unitBlockStart;

    const splitRecords = await Promise.all(
      req.body.records.map(async (record) => {
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

        if (record.unitOwner) {
          newRecord.unitOwner = record.unitOwner;
        }

        return newRecord;
      }),
    );

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
    await assertHomeOrgExists();

    const csvFile = assertCsvFileInRequest(req);
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
