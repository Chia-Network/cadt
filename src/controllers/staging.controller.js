import _ from 'lodash';

import { Staging } from '../models';

import {
  optionallyPaginatedResponse,
  paginationParams,
} from '../utils/helpers';

import {
  assertStagingRecordExists,
  assertHomeOrgExists,
  assertNoPendingCommits,
  assertWalletIsSynced,
  assertWalletIsAvailable,
  assertDataLayerAvailable,
  assertIfReadOnlyMode,
  assertStagingTableNotEmpty,
} from '../utils/data-assertions';

export const findAll = async (req, res) => {
  try {
    let { page, limit, type, table } = req.query;

    let pagination = paginationParams(page, limit);

    let where = {};
    if (type === 'staged') {
      where = { commited: false, failedCommit: false };
    } else if (type === 'pending') {
      where = { commited: true, failedCommit: false };
    } else if (type === 'failed') {
      where = { failedCommit: true };
    }

    if (table) {
      where.table = table;
    }

    let stagingData = await Staging.findAndCountAll({
      distinct: true,
      where,
      ...pagination,
    });

    const results = await Promise.all(
      stagingData.rows.map(async (stagingRecord) => {
        const { uuid, table, action, data } = stagingRecord;
        const workingData = _.cloneDeep(stagingRecord.dataValues);
        workingData.diff = await Staging.getDiffObject(
          uuid,
          table,
          action,
          data,
        );

        delete workingData.data;

        return workingData;
      }),
    );

    stagingData.rows = results;

    const response = optionallyPaginatedResponse(stagingData, page, limit);

    res.json(response);
  } catch (error) {
    res.status(400).json({
      message: 'Error retreiving staging table',
      error: error.message,
    });
  }
};

export const commit = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertStagingTableNotEmpty();
    await assertHomeOrgExists();
    await assertDataLayerAvailable();
    await assertWalletIsAvailable();
    await assertWalletIsSynced();
    await assertNoPendingCommits();

    await Staging.pushToDataLayer(
      _.get(req, 'query.table', null),
      _.get(req, 'body.comment', ''),
    );
    res.json({ message: 'Staging Table committed to full node' });
  } catch (error) {
    console.trace(error);
    res.status(400).json({
      message: 'Error commiting staging table',
      error: error.message,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertStagingRecordExists(req.body.uuid);
    await Staging.destroy({
      where: {
        uuid: req.body.uuid,
      },
    });
    res.json({
      message: 'Deleted from stage',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Staging Record can not be removed.',
      error: error.message,
    });
  }
};

export const clean = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await Staging.destroy({
      where: {},
      truncate: true,
    });
    res.json({
      message: 'Staging Data Cleaned',
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

export const retryRecrod = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertStagingRecordExists(req.body.uuid);

    await Staging.update(
      { failedCommit: false, commited: false },
      {
        where: {
          uuid: req.body.uuid,
        },
      },
    );
    res.json({
      message: 'Staging record re-staged.',
    });
  } catch (error) {
    res.status(400).json({
      message: 'Staging Record can not be restaged.',
      error: error.message,
    });
  }
};
