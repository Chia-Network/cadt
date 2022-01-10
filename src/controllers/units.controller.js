'use strict';

import _ from 'lodash';

import { uuid as uuidv4 } from 'uuidv4';
import {
  Staging,
  UnitMock,
  Unit,
  Qualification,
  Vintage,
  Organization, ProjectLocation, CoBenefit, RelatedProject, Project,
} from '../models';
import {columnsToInclude, optionallyPaginatedResponse, paginationParams} from './helpers';

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

    // The new unit is getting created in this registry
    newRecord.registry = orgUid;

    newRecord.unitCount =
      Number(newRecord.unitBlockEnd.replace(/^\D+/, '')) -
      Number(newRecord.unitBlockStart.replace(/^\D+/, ''));

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
    res.json({
      message: 'Error creating new Unit',
    });
  }
};

export const findAll = async (req, res) => {
  let { page, limit, columns } = req.query;
  
  const includes = [
    Qualification,
  ];
  
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
  if (req.query.useMock) {
    const record = UnitMock.findOne(req.query.id);
    if (record) {
      res.json(record);
    } else {
      res.json({ message: 'Not Found' });
    }

    return;
  }

  res.json(
    await Unit.findOne({
      where: { warehouseUnitId: req.query.warehouseUnitId },
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

    if (sumOfSplitUnits !== originalRecord.unitCount) {
      res.status(404).json({
        message: `The sum of the split units is ${sumOfSplitUnits} and the original record is ${originalRecord.unitCount}. These should be the same.`,
      });
      return;
    }

    const splitRecords = req.body.records.map((record, index) => {
      const newRecord = _.cloneDeep(originalRecord);
      newRecord.warehouseUnitId = uuidv4();
      console.log(uuidv4());
      newRecord.unitCount = record.unitCount;

      if (record.orgUid) {
        newRecord.unitOwnerOrgUid = record.orgUid;
      }

      return newRecord;
    });

    // console.log(splitRecords);

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
    });
  }
};
