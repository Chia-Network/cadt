'use strict';

import { uuid as uuidv4 } from 'uuidv4';
import { Staging, UnitMock, Unit, Qualification, Vintage } from '../models';
import { paginationParams } from './helpers';

export const create = async (req, res) => {
  try {
    // When creating new projects assign a uuid to is so
    // multiple organizations will always have unique ids
    const uuid = uuidv4();
    const stagedData = {
      uuid,
      action: 'INSERT',
      table: 'Units',
      data: JSON.stringify([req.body]),
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
    res.json(
      await Unit.findAll({
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
    );
    return;
  }

  res.json(
    await Unit.findAll({
      include: [
        {
          model: Qualification,
          as: 'qualification',
        },
        Vintage,
      ],
      ...paginationParams(page, limit),
    }),
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
    await Unit.findAll({
      where: { id: req.query.id },
      include: [
        {
          model: Qualification,
          as: 'qualification',
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

    await Staging.create(stagedData);

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
