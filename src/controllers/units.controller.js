'use strict';

import _ from 'lodash';

import { uuid as uuidv4 } from 'uuidv4';
import { Staging, UnitMock, Unit, Qualification, Vintage } from '../models';
import { optionallyPaginatedResponse, paginationParams } from './helpers';

export const create = async (req, res) => {
  try {
    const newRecord = _.cloneDeep(req.body);

    // When creating new projects assign a uuid to is so
    // multiple organizations will always have unique ids
    const uuid = uuidv4();

    newRecord.warehouseProjectId = uuid;

    // All new units are assigned to the home orgUid
    const orgUid = _.head(Object.keys(await Organization.getHomeOrg()));
    newRecord.orgUid = orgUid;

    // The new unit is getting created in this registry
    newRecord.registry = orgUid;

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
  const { page, limit } = req.query;

  if (req.query.useMock) {
    res.json(UnitMock.findAll({ ...paginationParams(page, limit) }));
    return;
  }

  if (req.query.onlyEssentialColumns) {
    return res.json(
      optionallyPaginatedResponse(
        await Unit.findAndCountAll({
          distinct: true,
          attributes: [
            'orgUid',
            'unitLink',
            'registry',
            'unitType',
            'unitCount',
            'unitStatus',
            'unitStatusDate',
          ],
        }),
        page,
        limit,
      ),
    );
  }

  res.json(
    optionallyPaginatedResponse(
      await Unit.findAndCountAll({
        distinct: true,
        include: [
          {
            model: Qualification,
            as: 'qualifications',
          },
          Vintage,
        ],
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
      where: { uuid: req.query.uuid },
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
      uuid: req.body.uuid,
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
      uuid: req.body.uuid,
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
    const originalRecord = await Unit.findOne({
      where: { uuid: req.body.unitUid },
    });

    if (!originalRecord) {
      res.status(404).json({
        message: `The unit record for the uuid: ${req.body.unitUid} does not exist`,
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

    const splitRecords = req.body.records.map((record) => {
      const newRecord = _.cloneDeep(originalRecord);
      newRecord.uuid = uuidv4();
      newRecord.unitCount = record.unitCount;

      if (record.orgUid) {
        newRecord.orgUid = record.orgUid;
      }

      return newRecord;
    });

    const stagedData = {
      uuid: req.body.unitUid,
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
