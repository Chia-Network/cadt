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
    const originalRecordResult = await Project.findByPk(
      req.body.warehouseProjectId,
    );

    if (!originalRecordResult) {
      res.status(404).json({
        message: `The Project record for the warehouseUnitId: ${req.body.warehouseProjectId} does not exist and can not be updated`,
      });
      return;
    }

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
    const originalRecordResult = await Project.findByPk(
      req.body.warehouseProjectId,
    );

    if (!originalRecordResult) {
      res.status(404).json({
        message: `The Project record for the warehouseUnitId: ${req.body.warehouseProjectId} does not exist and can not be updated`,
      });
      return;
    }

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

  csv()
    .fromStream(stream)
    .subscribe(async (newRecord) => {
      let action = 'UPDATE';

      if (newRecord.warehouseProjectId) {
        // Fail if they supplied their own warehouseUnitId and it doesnt exist
        const possibleExistingRecord = await Project.findByPk(
          newRecord.warehouseProjectId,
        );

        if (!possibleExistingRecord) {
          throw new Error(
            `Trying to update a record that doesnt exists, ${newRecord.warehouseProjectId}. To fix, remove the warehouseProjectId from this record so it will be treated as a new record`,
          );
        }
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

      await Staging.upsert(stagedData);
    })
    .on('error', (error) => {
      if (!res.headersSent) {
        res.status(400).json({ message: error.message });
      }
    })
    .on('done', () => {
      if (!res.headersSent) {
        res.json({ message: 'CSV processing complete' });
      }
    });
};
