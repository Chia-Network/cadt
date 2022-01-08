import _ from 'lodash';

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
  Organization,
} from '../models';

import { optionallyPaginatedResponse, paginationParams } from './helpers';

export const create = async (req, res) => {
  const newRecord = _.cloneDeep(req.body);
  // When creating new projects assign a uuid to is so
  // multiple organizations will always have unique ids
  const uuid = uuidv4();

  newRecord.warehouseProjectId = uuid;

  // All new projects are assigned to the home orgUid
  const orgUid = _.head(Object.keys(await Organization.getHomeOrg()));
  newRecord.orgUid = orgUid;

  // The new project is getting created in this registry
  newRecord.currentRegistry = orgUid;

  // Unless we are overriding, a new project originates in this org
  if (!newRecord.registryOfOrigin) {
    newRecord.registryOfOrigin = orgUid;
  }

  try {
    await Staging.create({
      uuid,
      action: 'INSERT',
      table: 'Projects',
      data: JSON.stringify([newRecord]),
    });
    res.json('Added project to stage');
  } catch (err) {
    res.json(err);
  }
};

export const findAll = async (req, res) => {
  const { page, limit, search, orgUid, columns, useMock } = req.query;

  if (useMock) {
    res.json(ProjectMock.findAll({ ...paginationParams(page, limit) }));
    return;
  }
  
  let columnsList = [];
  let fkInclude = [
    ProjectLocation,
    Qualification,
    Vintage,
    CoBenefit,
    RelatedProject,
  ];
  
  if (columns) {
    columnsList = columns.split(',');
    // Check to ensure passed in columns are valid
    if (
      columnsList.filter((col) => Project.validApiColumns.includes(col)).length !==
      columnsList.length
    ) {
      console.error('Invalid column specified');
      res.status(400).send('Invalid column specified');
      return;
    }
    // What foreign keys should we include?
    fkInclude = _.intersection(
      columnsList,
      Project.foreignColumns
    ).map(fk => Project.apiFkRelationships[fk]);
    
    // What non fk columns are being requested?
    columnsList = columnsList.filter(column => !Project.foreignColumns.includes(column));
  } else {
    columnsList = Project.defaultColumns;
  }
  
  // If only FK fields have been specified, select just ID
  if (!columnsList.length) {
    columnsList = ['id'];
  }

  const dialect = sequelize.getDialect();

  let results;

  if (search) {
    const supportedSearchFields = columnsList.filter(
      (col) => !['createdAt', 'updatedAt'].includes(col),
    );

    if (dialect === 'sqlite') {
      results = await Project.findAllSqliteFts(
        search,
        orgUid,
        paginationParams(page, limit),
        supportedSearchFields,
      );
    } else if (dialect === 'mysql') {
      results = await Project.findAllMySQLFts(
        search,
        orgUid,
        paginationParams(page, limit),
        supportedSearchFields,
      );
    }
    return res.json(optionallyPaginatedResponse(results, page, limit));
  }
  
  console.log("!!!", columnsList)
  
  console.log(fkInclude)
  
  const query = {
    attributes: columnsList,
    include: fkInclude,
  };

  return res.json(
    optionallyPaginatedResponse(
      await Project.findAndCountAll({
        distinct: true,
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
