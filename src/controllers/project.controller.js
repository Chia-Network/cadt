import _ from 'lodash';
import xlsx from 'node-xlsx';
import { uuid as uuidv4 } from 'uuidv4';

import {
  Staging,
  Project,
  ProjectLocation,
  Label,
  Issuance,
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
  assertHomeOrgExists,
} from '../utils/data-assertions';

import { createProjectRecordsFromCsv } from '../utils/csv-utils';
import {
  tableDataFromXlsx,
  createXlsFromSequelizeResults,
  sendXls,
  updateTablesWithData,
} from '../utils/xls';

export const create = async (req, res) => {
  try {
    await assertHomeOrgExists();

    const newRecord = _.cloneDeep(req.body);
    // When creating new projects assign a uuid to is so
    // multiple organizations will always have unique ids
    const uuid = uuidv4();

    newRecord.warehouseProjectId = uuid;

    // All new projects are assigned to the home orgUid
    const { orgUid } = await Organization.getHomeOrg();
    newRecord.orgUid = orgUid;

    // The new project is getting created in this registry
    newRecord.currentRegistry = orgUid;

    // Unless we are overriding, a new project originates in this org
    if (!newRecord.registryOfOrigin) {
      newRecord.registryOfOrigin = orgUid;
    }

    await Staging.create({
      uuid,
      action: 'INSERT',
      table: Project.stagingTableName,
      data: JSON.stringify([newRecord]),
    });
    res.json({ message: 'Project staged successfully' });
  } catch (err) {
    res.status(400).json({
      message: 'Error creating new project',
      error: err.message,
    });
  }
};

export const findAll = async (req, res) => {
  let { page, limit, search, orgUid, columns, xls } = req.query;
  let where = orgUid ? { orgUid } : undefined;

  const includes = Project.getAssociatedModels();

  if (columns) {
    // Remove any unsupported columns
    columns = columns.filter((col) =>
      Project.defaultColumns
        .concat(includes.map((model) => model.name + 's'))
        .includes(col),
    );
  } else {
    columns = Project.defaultColumns.concat(
      includes.map((model) => model.name + 's'),
    );
  }

  // If only FK fields have been specified, select just ID
  if (!columns.length) {
    columns = ['warehouseProjectId'];
  }

  let results;
  let pagination = paginationParams(page, limit);

  if (xls) {
    pagination = { page: undefined, limit: undefined };
  }

  if (search) {
    results = await Project.fts(search, orgUid, pagination, columns);
  }

  if (!results) {
    const query = {
      ...columnsToInclude(columns, includes),
      ...pagination,
    };

    results = await Project.findAndCountAll({
      distinct: true,
      where,
      ...query,
    });
  }

  const response = optionallyPaginatedResponse(results, page, limit);

  if (!xls) {
    return res.json(response);
  } else {
    return sendXls(
      Project.name,
      createXlsFromSequelizeResults(response, Project),
      res,
    );
  }
};

export const findOne = async (req, res) => {
  const query = {
    where: { warehouseProjectId: req.query.warehouseProjectId },
    include: [ProjectLocation, Label, Issuance, CoBenefit, RelatedProject],
  };

  res.json(await Project.findOne(query));
};

export const updateFromXLS = async (req, res) => {
  const { files } = req;

  if (files && files.xlsx) {
    const xlsxParsed = xlsx.parse(files.xlsx.data);
    const stagedDataItems = tableDataFromXlsx(xlsxParsed, Project);
    await updateTablesWithData(stagedDataItems);
    res.json({
      message: 'Updates from xlsx added to staging',
    });
  } else {
    res.status(400).json({
      message: 'File not received',
      error: 'File not received',
    });
  }
};

export const update = async (req, res) => {
  try {
    await assertHomeOrgExists();

    const originalRecord = await assertProjectRecordExists(
      req.body.warehouseProjectId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

    // merge the new record into the old record
    let stagedRecord = Array.isArray(req.body) ? req.body : [req.body];
    stagedRecord = stagedRecord.map((record) =>
      Object.assign({}, originalRecord, record),
    );

    const stagedData = {
      uuid: req.body.warehouseProjectId,
      action: 'UPDATE',
      table: Project.stagingTableName,
      data: JSON.stringify(stagedRecord),
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
    await assertHomeOrgExists();

    const originalRecord = await assertProjectRecordExists(
      req.body.warehouseProjectId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

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
    await assertHomeOrgExists();

    const csvFile = assertCsvFileInRequest(req);
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
