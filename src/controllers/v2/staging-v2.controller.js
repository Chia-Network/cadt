'use strict';

import _ from 'lodash';
import { Sequelize } from 'sequelize';
import { StagingV2 } from '../../models/v2/index.js';
import { logger } from '../../config/logger.js';
import {
  assertIfReadOnlyMode,
  assertHomeOrgExists,
  assertWalletIsSynced,
  assertStagingTableNotEmpty,
  assertNoPendingCommits,
  assertStagingRecordExists,
} from '../../utils/data-assertions.js';
import { optionallyPaginatedResponse, paginationParams } from '../../utils/helpers.js';

export const StagingV2Controller = {
  async hasPendingCommits(req, res) {
    try {
      const pendingCommits = await StagingV2.count({
        where: {
          commited: true,
          failedCommit: false,
        },
      });

      if (pendingCommits > 0) {
        return res.json({
          message: 'There are currently pending commits',
          success: true,
        });
      }

      return res.json({
        message: 'No pending commits',
        success: true,
      });
    } catch (error) {
      logger.error('Error checking pending commits:', error);
      res.status(400).json({
        message: 'Error checking pending commits',
        error: error.message,
        success: false,
      });
    }
  },

  async findAll(req, res) {
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

      let stagingData = await StagingV2.findAndCountAll({
        distinct: true,
        where,
        ...pagination,
      });

      const results = await Promise.all(
        stagingData.rows.map(async (stagingRecord) => {
          const { uuid, table, action, data } = stagingRecord;
          const workingData = _.cloneDeep(stagingRecord.dataValues);
          workingData.diff = await StagingV2.getDiffObject(
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
      logger.error('Error retrieving V2 staging table:', error);
      res.status(400).json({
        message: 'Error retrieving V2 staging table',
        error: error.message,
        success: false,
      });
    }
  },

  async commit(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertStagingTableNotEmpty(StagingV2);
      await assertHomeOrgExists();
      await assertWalletIsSynced();
      await assertNoPendingCommits(StagingV2);

      await StagingV2.pushToDataLayer(
        _.get(req, 'query.table', null),
        _.get(req, 'body.comment', ''),
        _.get(req, 'body.author', ''),
        _.get(req, 'body.ids', []),
      );

      res.json({
        message: 'V2 Staging Table committed to full node',
        success: true,
      });
    } catch (error) {
      logger.error('Error committing V2 staging table:', error);
      res.status(400).json({
        message: 'Error committing V2 staging table',
        error: error.message,
        success: false,
      });
    }
  },

  async destroy(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertHomeOrgExists();
      await assertStagingRecordExists(req.body.uuid, StagingV2);

      await StagingV2.destroy({
        where: {
          uuid: req.body.uuid,
        },
      });

      res.json({
        message: 'V2 Staging record deleted',
        success: true,
      });
    } catch (error) {
      logger.error('Error deleting V2 staging record:', error);
      res.status(400).json({
        message: 'Error deleting V2 staging record',
        error: error.message,
        success: false,
      });
    }
  },

  async clean(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertHomeOrgExists();
      await StagingV2.destroy({
        where: {
          id: {
            [Sequelize.Op.ne]: null,
          },
        },
        truncate: true,
      });
      res.json({
        message: 'V2 Staging Data Cleaned',
        success: true,
      });
    } catch (error) {
      logger.error('Error cleaning V2 staging data:', error);
      res.status(400).json({
        message: error.message,
        success: false,
      });
    }
  },

  async editRecord(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertHomeOrgExists();
      await assertStagingRecordExists(req.body.uuid, StagingV2);

      await StagingV2.update(
        { data: JSON.stringify(req.body.data) },
        {
          where: {
            uuid: req.body.uuid,
          },
        },
      );

      res.json({
        message: 'V2 Staging record updated',
        success: true,
      });
    } catch (error) {
      logger.error('Error updating V2 staging record:', error);
      res.status(400).json({
        message: 'Error updating V2 staging record',
        error: error.message,
        success: false,
      });
    }
  },

  async retryRecord(req, res) {
    try {
      await assertIfReadOnlyMode();
      await assertHomeOrgExists();
      await assertStagingRecordExists(req.body.uuid, StagingV2);

      await StagingV2.update(
        { failedCommit: false, commited: false },
        {
          where: {
            uuid: req.body.uuid,
          },
        },
      );
      res.json({
        message: 'V2 Staging record re-staged',
        success: true,
      });
    } catch (error) {
      logger.error('Error retrying V2 staging record:', error);
      res.status(400).json({
        message: 'V2 Staging Record cannot be restaged',
        error: error.message,
        success: false,
      });
    }
  },
};
