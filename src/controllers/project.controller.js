import _ from 'lodash';

import { uuid as uuidv4 } from 'uuidv4';

import {
  Staging,
  Project,
  ProjectLocation,
  Qualification,
  Vintage,
  CoBenefit,
  RelatedProject,
  Organization,
} from '../models';

import {
  columnsToInclude,
  optionallyPaginatedResponse,
  paginationParams,
} from '../utils/helpers';

import {
  assertOrgIsHomeOrg,
  assertProjectRecordExists,
  assertCsvFileInRequest,
} from '../utils/data-assertions';

import { createProjectRecordsFromCsv } from '../utils/csv-utils';

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
      table: Project.stagingTableName,
      data: JSON.stringify([newRecord]),
    });
    res.json('Added project to stage');
  } catch (err) {
    res.status(400).json({
      message: 'Error creating new project',
      error: err.message,
    });
  }
};

export const findAll = async (req, res) => {
  let { page, limit, search, orgUid, columns } = req.query;
  let where = orgUid ? { orgUid } : undefined;

  const includes = [
    ProjectLocation,
    Qualification,
    Vintage,
    CoBenefit,
    RelatedProject,
  ];

  if (columns) {
    // Remove any unsupported columns
    columns = columns.filter((col) =>
      Project.defaultColumns
        .concat(includes.map((model) => model.name + 's'))
        .includes(col),
    );
  } else {
    columns = Project.defaultColumns;
  }

  // If only FK fields have been specified, select just ID
  if (!columns.length) {
    columns = ['warehouseProjectId'];
  }

  let results;

  if (search) {
    results = await Project.fts(
      search,
      orgUid,
      paginationParams(page, limit),
      columns,
    );
  }

  if (!results) {
    const query = {
      ...columnsToInclude(columns, includes),
      ...paginationParams(page, limit),
    };

    results = await Project.findAndCountAll({
      distinct: true,
      where,
      ...query,
    });
  }

  return res.json(optionallyPaginatedResponse(results, page, limit));
};

export const findOne = async (req, res) => {
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
    const originalRecord = await assertProjectRecordExists(
      req.body.warehouseProjectId,
    );

    assertOrgIsHomeOrg(res, originalRecord.orgUid);

    const stagedData = {
      uuid: req.body.warehouseProjectId,
      action: 'UPDATE',
      table: Project.stagingTableName,
      data: JSON.stringify(Array.isArray(req.body) ? req.body : [req.body]),
    };

    await Staging.upsert(stagedData);

    res.json({
      message: 'Project update added to staging',
    });
  } catch (err) {
    res.status(400).json({
      message: 'Error adding update to stage',
      error: err.message,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    const originalRecord = await assertProjectRecordExists(
      req.body.warehouseProjectId,
    );

    assertOrgIsHomeOrg(res, originalRecord.orgUid);

    const stagedData = {
      uuid: req.body.warehouseProjectId,
      action: 'DELETE',
      table: Project.stagingTableName,
    };

    await Staging.create(stagedData);

    res.json({
      message: 'Project removal added to stage',
    });
  } catch (err) {
    res.status(400).json({
      message: 'Error adding project removal to stage',
      error: err.message,
    });
  }
};

export const batchUpload = async (req, res) => {
  try {
    const csvFile = await assertCsvFileInRequest(req);
    await createProjectRecordsFromCsv(csvFile);

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
