import _ from 'lodash';

import csv from 'csvtojson';
import { Readable } from 'stream';
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
} from '../utils/data-assertions';

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
      table: 'Projects',
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
      table: 'Projects',
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
  if (!_.get(req, 'files.csv')) {
    res
      .status(400)
      .json({ message: 'Can not file the required csv file in request' });
    return;
  }

  const csvFile = req.files.csv;
  const buffer = csvFile.data;
  const stream = Readable.from(buffer.toString('utf8'));

  const recordsToCreate = [];

  csv()
    .fromStream(stream)
    .subscribe(async (newRecord) => {
      let action = 'UPDATE';

      if (newRecord.warehouseProjectId) {
        // Fail if they supplied their own warehouseProjectId and it doesnt exist
        const possibleExistingRecord = await assertProjectRecordExists(
          newRecord.warehouseProjectId,
        );

        assertOrgIsHomeOrg(res, possibleExistingRecord.dataValues.orgUid);
      } else {
        // When creating new unitd assign a uuid to is so
        // multiple organizations will always have unique ids
        const uuid = uuidv4();
        newRecord.warehouseProjectId = uuid;

        action = 'INSERT';
      }

      const orgUid = _.head(Object.keys(await Organization.getHomeOrg()));

      // All new records are registered within this org, but give them a chance to override this
      if (!newRecord.orgUid) {
        newRecord.orgUid = orgUid;
      }

      const stagedData = {
        uuid: newRecord.warehouseProjectId,
        action: action,
        table: 'Projects',
        data: JSON.stringify([newRecord]),
      };

      recordsToCreate.push(stagedData);
    })
    .on('error', (error) => {
      if (!res.headersSent) {
        res.status(400).json({
          message: 'Batch Upload Failed.',
          error: error.message,
        });
      }
    })
    .on('done', async () => {
      if (recordsToCreate.length) {
        await Staging.bulkCreate(recordsToCreate);

        if (!res.headersSent) {
          res.json({
            message:
              'CSV processing complete, your records have been added to the staging table.',
          });
        }
      } else {
        if (!res.headersSent) {
          res
            .status(400)
            .json({ message: 'There were no valid records to parse' });
        }
      }
    });
};
