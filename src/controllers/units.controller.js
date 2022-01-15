'use strict';

import _ from 'lodash';

import csv from 'csvtojson';
import { Readable } from 'stream';
import { uuid as uuidv4 } from 'uuidv4';

import { Staging, Unit, Qualification, Vintage, Organization } from '../models';

import {
  columnsToInclude,
  optionallyPaginatedResponse,
  paginationParams,
  transformSerialNumberBlock,
  createSerialNumberStr,
} from '../utils/helpers';

export const create = async (req, res, next) => {
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
      table: 'Units',
      data: JSON.stringify([newRecord]),
    };

    await Staging.create(stagedData);

    res.json({
      message: 'Unit created successfully',
    });
  } catch (err) {
    next(err);
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
    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'UPDATE',
      table: 'Units',
      data: JSON.stringify(Array.isArray(req.body) ? req.body : [req.body]),
    };

    await Staging.upsert(stagedData);

    res.json({
      message: 'Unit updated successfully',
    });
  } catch (err) {
    res.json({
      message: 'Error updating new unit',
    });
  }
};

export const destroy = async (req, res) => {
  try {
    const stagedData = {
      uuid: req.body.warehouseUnitId,
      action: 'DELETE',
      table: 'Units',
    };

    await Staging.upsert(stagedData);
    res.json({
      message: 'Unit deleted successfully',
    });
  } catch (err) {
    res.json({
      message: 'Error deleting new unit',
      err,
    });
  }
};

export const split = async (req, res) => {
  try {
    const originalRecordResult = await Unit.findByPk(req.body.warehouseUnitId);
    const originalRecord = originalRecordResult.dataValues;

    // we dont need these fields for split
    delete originalRecord.createdAt;
    delete originalRecord.updatedAt;

    if (!originalRecord) {
      res.status(404).json({
        message: `The unit record for the warehouseUnitId: ${req.body.warehouseUnitId} does not exist`,
      });
      return;
    }

    const sumOfSplitUnits = req.body.records.reduce(
      (previousValue, currentValue) =>
        previousValue.unitCount + currentValue.unitCount,
    );

    // eslint-disable-next-line no-unused-vars
    const [unitBlockStart, unitBlockEnd, unitCount] =
      transformSerialNumberBlock(originalRecord.serialNumberBlock);

    if (sumOfSplitUnits !== unitCount) {
      res.status(404).json({
        message: `The sum of the split units is ${sumOfSplitUnits} and the original record is ${unitCount}. These should be the same.`,
      });
      return;
    }

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
      table: 'Units',
      data: JSON.stringify(splitRecords),
    };

    await Staging.upsert(stagedData);

    res.json({
      message: 'Unit split successful',
    });
  } catch (err) {
    res.json({
      message: 'Error splitting unit',
      error: err,
    });
  }
};

export const batchUpload = async (req, res) => {
  if (!_.get(req, 'files.csv')) {
    res
      .status(400)
      .json({ message: 'Can not file the required csv file in request' });
    return;
  }

  const csvFile = req.files.csv;
  const buffer = csvFile.data;
  const stream = Readable.from(buffer.toString('utf8'));

  csv()
    .fromStream(stream)
    .subscribe(async (newRecord) => {
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
        table: 'Units',
        data: JSON.stringify([newRecord]),
      };

      await Staging.upsert(stagedData);
    })
    .on('error', () => {
      req
        .status(400)
        .json({ message: 'There was an error processing the csv file' });
    })
    .on('done', () => {
      res.json({ message: 'CSV processing complete' });
    });
};
