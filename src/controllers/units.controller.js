'use strict';

import _ from 'lodash';

import { uuid as uuidv4 } from 'uuidv4';
import {
  Staging,
  UnitMock,
  Unit,
  Qualification,
  Vintage,
  Organization,
  ProjectLocation,
  CoBenefit,
  RelatedProject,
  Project,
} from '../models';
import {
  columnsToInclude,
  optionallyPaginatedResponse,
  paginationParams,
  transformSerialNumberBlock,
  createSerialNumberStr,
} from './helpers';

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
  let { page, limit, columns } = req.query;

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

  res.json(
    optionallyPaginatedResponse(
      await Unit.findAndCountAll({
        distinct: true,
        ...columnsToInclude(columns, includes),
        ...paginationParams(page, limit),
      }),
      page,
      limit,
    ),
  );
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

    await Staging.create(stagedData);
    res.json({
      message: 'Unit deleted successfully',
    });
  } catch (err) {
    res.json({
      message: 'Error deleting new unit',
    });
  }
};

export const split = async (req, res) => {
  try {
    const originalRecordResult = await Unit.findByPk(req.body.warehouseUnitId);
    const originalRecord = originalRecordResult.dataValues;

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
