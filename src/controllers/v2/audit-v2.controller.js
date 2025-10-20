'use strict';

import { AuditV2 } from '../../models/v2/index.js';
import _ from 'lodash';
import { logger } from '../../config/logger.js';
import {
  paginationParams,
  optionallyPaginatedResponse,
} from '../../utils/helpers.js';
import { assertIfReadOnlyMode } from '../../utils/data-assertions.js';

export const AuditV2Controller = {
  async findAll(req, res) {
    try {
      const { page, limit, orgUid, order } = req.query;

      const pagination = paginationParams(page, limit);

      const auditResults = await AuditV2.findAndCountAll({
        where: { orgUid },
        order: [['onchainConfirmationTimeStamp', order || 'DESC']],
        ...pagination,
      });

      return res.json(optionallyPaginatedResponse(auditResults, page, limit));
    } catch (error) {
      logger.error('Error retrieving V2 audit data:', error);
      res.status(400).json({
        message: 'Cannot retrieve V2 audit data',
        error: error.message,
        success: false,
      });
    }
  },

  async findConflicts(req, res) {
    try {
      return res.json(await AuditV2.findConflicts());
    } catch (error) {
      logger.error('Error retrieving V2 audit conflicts:', error);
      res.status(400).json({
        message: 'Cannot retrieve V2 audit conflicts',
        error: error.message,
        success: false,
      });
    }
  },

  async resetToGeneration(req, res) {
    try {
      await assertIfReadOnlyMode();

      const { generation } = req.body;

      if (!generation) {
        return res.status(400).json({
          message: 'Generation is required',
          success: false,
        });
      }

      await AuditV2.resetToGeneration(generation);

      res.json({
        message: 'V2 Audit reset to generation successfully',
        success: true,
      });
    } catch (error) {
      logger.error('Error resetting V2 audit to generation:', error);
      res.status(400).json({
        message: 'Error resetting V2 audit to generation',
        error: error.message,
        success: false,
      });
    }
  },

  async getLatestGeneration(req, res) {
    try {
      const latestGeneration = await AuditV2.getLatestGeneration();
      res.json({
        generation: latestGeneration,
        success: true,
      });
    } catch (error) {
      logger.error('Error getting latest V2 audit generation:', error);
      res.status(400).json({
        message: 'Error getting latest V2 audit generation',
        error: error.message,
        success: false,
      });
    }
  },

  async getGenerationStats(req, res) {
    try {
      const stats = await AuditV2.getGenerationStats();
      res.json({
        stats,
        success: true,
      });
    } catch (error) {
      logger.error('Error getting V2 audit generation stats:', error);
      res.status(400).json({
        message: 'Error getting V2 audit generation stats',
        error: error.message,
        success: false,
      });
    }
  },
};
