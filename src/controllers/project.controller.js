import { uuid as uuidv4 } from 'uuidv4';
import { sequelize } from '../models/database';
import {
  Staging,
  ProjectMock,
  Project,
  ProjectLocation,
  Qualification,
  Vintage,
  CoBenefit,
  RelatedProject,
} from '../models';

import { paginationParams } from './helpers';

export const create = async (req, res) => {
  // When creating new projects assign a uuid to is so
  // multiple organizations will always have unique ids
  const uuid = uuidv4();

  try {
    await Staging.create({
      uuid,
      action: 'INSERT',
      table: 'Projects',
      data: JSON.stringify([req.body]),
    });
    res.json('Added project to stage');
  } catch (err) {
    res.json(err);
  }
};

export const findAll = async (req, res) => {
  const { page, limit, search, orgUid } = req.query;

  if (req.query.useMock) {
    res.json(ProjectMock.findAll({ ...paginationParams(page, limit) }));
    return;
  }

  const dialect = sequelize.getDialect();

  if (search) {
    if (dialect === 'sqlite') {
      res.json(await Project.findAllSqliteFts(search, orgUid, paginationParams(page, limit)));
    } else if (dialect === 'mysql') {
      res.json(await Project.findAllMySQLFts(search, orgUid, paginationParams(page, limit)));
    }
  } else {
    const query = {
      include: [
        ProjectLocation,
        Qualification,
        Vintage,
        CoBenefit,
        RelatedProject,
      ],
    };

    if (orgUid) {
      query.where = {
        orgUid,
      };
    }

    res.json(await Project.findAll({ ...query, ...paginationParams(page, limit) }));
  }
};

export const findOne = (req, res) => {
  if (req.query.useMock) {
    const record = ProjectMock.findOne(req.query.id);
    if (record) {
      res.json(record);
    } else {
      res.json({ message: 'Not Found' });
    }

    return;
  }

  res.json({
    message: 'Not Yet Implemented',
  });
};

export const update = async (req, res) => {
  try {
    const stagedData = {
      uuid: req.body.warehouseProjectId,
      action: 'UPDATE',
      table: 'Projects',
      data: JSON.stringify(Array.isArray(req.body) ? req.body : [req.body]),
    };

    await Staging.create(stagedData);

    res.json({
      message: 'Project update added to staging',
    });
  } catch (err) {
    res.json({
      message: 'Error adding update to stage',
      error: err,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    const stagedData = {
      uuid: req.body.warehouseProjectId,
      action: 'DELETE',
      table: 'Projects',
    };

    await Staging.create(stagedData);

    res.json({
      message: 'Project removal added to stage',
    });
  } catch (err) {
    res.json({
      message: 'Error adding project removal to stage',
    });
  }
};
