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

import { optionallyPaginatedResponse, paginationParams } from './helpers';

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
  const { page, limit, search, orgUid, onlyEssentialColumns, useMock } =
    req.query;

  if (useMock) {
    res.json(ProjectMock.findAll({ ...paginationParams(page, limit) }));
    return;
  }

  const dialect = sequelize.getDialect();

  let results;

  if (search) {
    if (dialect === 'sqlite') {
      results = await Project.findAllSqliteFts(
        search,
        orgUid,
        paginationParams(page, limit),
      );
    } else if (dialect === 'mysql') {
      results = await Project.findAllMySQLFts(
        search,
        orgUid,
        paginationParams(page, limit),
      );
    }
    return res.json(optionallyPaginatedResponse(results, page, limit));
  }

  if (onlyEssentialColumns) {
    const query = {
      attributes: [
        'orgUid',
        'warehouseProjectId',
        'currentRegistry',
        'registryOfOrigin',
        'projectLink',
        'projectStatus',
        'projectTag',
      ],
    };

    if (orgUid) {
      query.where = {
        orgUid,
      };
    }

    return res.json(
      optionallyPaginatedResponse(
        await Project.findAndCountAll({
          ...query,
          ...paginationParams(page, limit),
        }),
        page,
        limit,
      ),
    );
  }

  const query = {
    include: [
      ProjectLocation,
      Qualification,
      Vintage,
      CoBenefit,
      RelatedProject,
    ],
  };

  return res.json(
    optionallyPaginatedResponse(
      await Project.findAndCountAll({
        ...query,
        ...paginationParams(page, limit),
      }),
      page,
      limit,
    ),
  );
};

export const findOne = async (req, res) => {
  if (req.query.useMock) {
    const record = ProjectMock.findOne(req.query.id);
    if (record) {
      res.json(record);
    } else {
      res.json({ message: 'Not Found' });
    }

    return;
  }

  const query = {
    where: { warehouseProjectId: res.query.warehouseProjectId },
    include: [
      ProjectLocation,
      Qualification,
      Vintage,
      CoBenefit,
      RelatedProject,
    ],
  };

  res.json(await Project.findOne(query));
};

export const update = async (req, res) => {
  try {
    const stagedData = {
      uuid: req.body.warehouseProjectId,
      action: 'UPDATE',
      table: 'Projects',
      data: JSON.stringify(Array.isArray(req.body) ? req.body : [req.body]),
    };

    await Staging.upsert(stagedData);

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
