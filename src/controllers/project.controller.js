import _ from 'lodash';

import { Sequelize } from 'sequelize';
import xlsx from 'node-xlsx';
import { uuid as uuidv4 } from 'uuidv4';

import { Staging, Project, Organization, ModelKeys } from '../models';

import { logger } from '../config/logger.cjs';

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
  assertNoPendingCommits,
  assertRecordExistance,
  assertIfReadOnlyMode,
} from '../utils/data-assertions';

import { createProjectRecordsFromCsv } from '../utils/csv-utils';
import {
  tableDataFromXlsx,
  createXlsFromSequelizeResults,
  sendXls,
  updateTableWithData,
  collapseTablesData,
  transformMetaUid,
} from '../utils/xls';
import { formatModelAssociationName } from '../utils/model-utils.js';

export const create = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const newRecord = _.cloneDeep(req.body);
    // When creating new projects assign a uuid to is so
    // multiple organizations will always have unique ids
    const uuid = uuidv4();

    newRecord.warehouseProjectId = uuid;
    newRecord.timeStaged = Math.floor(Date.now() / 1000);

    // All new projects are assigned to the home orgUid
    const { orgUid } = await Organization.getHomeOrg();
    newRecord.orgUid = orgUid;

    const childRecordsKeys = [
      'projectLocations',
      'issuances',
      'coBenefits',
      'relatedProjects',
      'projectRatings',
      'estimations',
      'labels',
    ];

    const existingChildRecordKeys = childRecordsKeys.filter((key) =>
      Boolean(newRecord[key]),
    );

    for (let i = 0; i < existingChildRecordKeys.length; i++) {
      const key = existingChildRecordKeys[i];
      await Promise.all(
        newRecord[key].map(async (childRecord) => {
          if (childRecord.id) {
            // If we are reusing an existing child record,
            // Make sure it exists
            await assertRecordExistance(ModelKeys[key], childRecord.id);
          } else {
            childRecord.id = uuidv4();
          }

          childRecord.orgUid = orgUid;
          childRecord.warehouseProjectId = uuid;
          return childRecord;
        }),
      );
    }

    await Staging.create({
      uuid,
      action: 'INSERT',
      table: Project.stagingTableName,
      data: JSON.stringify([newRecord]),
    });

    res.json({
      message: 'Project staged successfully',
      uuid,
    });
  } catch (err) {
    res.status(400).json({
      message: 'Error creating new project',
      error: err.message,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    let { page, limit, search, orgUid, columns, xls } = req.query;
    let where = orgUid != null && orgUid !== 'all' ? { orgUid } : undefined;

    if (orgUid === 'all') {
      // 'ALL' orgUid is just a UI concept but they keep forgetting this and send it
      // So delete this value if its sent so nothing breaks
      orgUid = undefined;
    }

    const includes = Project.getAssociatedModels();

    if (columns) {
      // Remove any unsupported columns
      columns = columns.filter((col) =>
        Project.defaultColumns
          .concat(includes.map(formatModelAssociationName))
          .includes(col),
      );
    } else {
      columns = Project.defaultColumns.concat(
        includes.map(formatModelAssociationName),
      );
    }

    // If only FK fields have been specified, select just ID
    if (!columns.length) {
      columns = ['warehouseProjectId'];
    }

    let pagination = paginationParams(page, limit);

    if (xls) {
      pagination = { page: undefined, limit: undefined };
    }

    if (search) {
      const ftsResults = await Project.fts(search, orgUid, {}, columns);
      const mappedResults = ftsResults.rows.map((ftsResult) =>
        _.get(ftsResult, 'dataValues.warehouseProjectId'),
      );

      if (!where) {
        where = {};
      }

      where.warehouseProjectId = {
        [Sequelize.Op.in]: mappedResults,
      };
    }

    const query = {
      ...columnsToInclude(columns, includes),
      ...pagination,
    };

    const results = await Project.findAndCountAll({
      distinct: true,
      where,
      order: [['timeStaged', 'DESC']],
      ...query,
    });

    const response = optionallyPaginatedResponse(results, page, limit);

    if (!xls) {
      return res.json(response);
    } else {
      return sendXls(
        Project.name,
        createXlsFromSequelizeResults({
          rows: response,
          model: Project,
          toStructuredCsv: false,
        }),
        res,
      );
    }
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error retrieving projects',
      error: error.message,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const query = {
      where: { warehouseProjectId: req.query.warehouseProjectId },
      include: Project.getAssociatedModels().map(
        (association) => association.model,
      ),
    };

    res.json(await Project.findOne(query));
  } catch (error) {
    res.status(400).json({
      message: 'Error retrieving projects',
      error: error.message,
    });
  }
};

export const updateFromXLS = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const { files } = req;

    if (!files || !files.xlsx) {
      throw new Error('File Not Received');
    }

    const xlsxParsed = transformMetaUid(xlsx.parse(files.xlsx.data));
    const stagedDataItems = tableDataFromXlsx(xlsxParsed, Project);
    const collapsedData = collapseTablesData(stagedDataItems, Project);

    await updateTableWithData(collapsedData, Project);

    res.json({
      message: 'Updates from xlsx added to staging',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Batch Upload Failed.',
      error: error.message,
    });
  }
};

export const update = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

    const originalRecord = await assertProjectRecordExists(
      req.body.warehouseProjectId,
    );

    await assertOrgIsHomeOrg(originalRecord.orgUid);

    const newRecord = _.cloneDeep(req.body);

    const { orgUid } = await Organization.getHomeOrg();
    newRecord.orgUid = orgUid;

    const childRecordsKeys = [
      'projectLocations',
      'issuances',
      'coBenefits',
      'relatedProjects',
      'projectRatings',
      'estimations',
      'labels',
    ];

    const existingChildRecordKeys = childRecordsKeys.filter((key) =>
      Boolean(newRecord[key]),
    );

    for (let i = 0; i < existingChildRecordKeys.length; i++) {
      const key = existingChildRecordKeys[i];
      await Promise.all(
        newRecord[key].map(async (childRecord) => {
          if (childRecord.id) {
            // If we are reusing an existing child record,
            // Make sure it exists
            await assertRecordExistance(ModelKeys[key], childRecord.id);
          } else {
            childRecord.id = uuidv4();
          }

          if (!childRecord.orgUid) {
            childRecord.orgUid = orgUid;
          }

          if (!childRecord.warehouseProjectId) {
            childRecord.warehouseProjectId = newRecord.warehouseProjectId;
          }

          if (key === 'labels' && childRecord.labelUnits) {
            childRecord.labelUnits.orgUid = orgUid;
          }

          return childRecord;
        }),
      );
    }

    // merge the new record into the old record
    let stagedRecord = Array.isArray(newRecord) ? newRecord : [newRecord];

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
      message: err.message,
    });
    logger.error('Error adding update to stage', err);
  }
};

export const destroy = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

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
      message: 'Project deleted successfully',
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
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommits();

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
