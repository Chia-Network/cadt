'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, MethodologyV2, OrganizationsV2 } from '../../models/v2/index.js';

import {
  optionallyPaginatedResponse,
  paginationParams,
} from '../../utils/helpers';

import {
  assertIfReadOnlyMode,
  assertHomeOrgExists,
} from '../../utils/data-assertions.js';

import {
  assertNoPendingCommitsExcludingTransfers,
} from '../../utils/v2-data-assertions.js';

import { logger } from '../../config/logger.js';
import { methodologyV2Schema } from '../../validations/v2/methodology-v2.validations.js';

export const create = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = methodologyV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error creating new methodology',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new methodology',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustMethodologyId')) {
      return res.status(400).json({
        message: 'Error creating new methodology',
        error: 'cadTrustMethodologyId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Generate UUID for primary key
    const uuid = uuidv4();
    newRecord.cadTrustMethodologyId = uuid;

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_methodology_id: uuid,
      methodology_code: newRecord.methodologyCode,
      methodology_name: newRecord.methodologyName,
      methodology_version: newRecord.methodologyVersion,
      methodology_date: newRecord.methodologyDate,
      methodology_link: newRecord.methodologyLink,
      methodology_type: newRecord.methodologyType,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'methodology',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      commited: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Methodology staged successfully',
      uuid,
      success: true,
    });
  } catch (err) {
    logger.error('Error creating methodology:', err);
    res.status(400).json({
      message: 'Error creating new methodology',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pagination = paginationParams(page, limit);

    const records = await MethodologyV2.findAndCountAll({
      ...pagination,
    });

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    logger.error('Error retrieving methodologies:', err);
    res.status(400).json({
      message: 'Error retrieving methodologies',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await MethodologyV2.findByPk(id);

    if (!record) {
      return res.status(404).json({
        message: 'Methodology not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    logger.error('Error retrieving methodology:', err);
    res.status(400).json({
      message: 'Error retrieving methodology',
      error: err.message,
      success: false,
    });
  }
};

export const update = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await MethodologyV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Methodology not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = methodologyV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error updating methodology',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating methodology',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_methodology_id: id,
    };

    if (updateData.methodologyCode !== undefined) dbUpdateData.methodology_code = updateData.methodologyCode;
    if (updateData.methodologyName !== undefined) dbUpdateData.methodology_name = updateData.methodologyName;
    if (updateData.methodologyVersion !== undefined) dbUpdateData.methodology_version = updateData.methodologyVersion;
    if (updateData.methodologyDate !== undefined) dbUpdateData.methodology_date = updateData.methodologyDate;
    if (updateData.methodologyLink !== undefined) dbUpdateData.methodology_link = updateData.methodologyLink;
    if (updateData.methodologyType !== undefined) dbUpdateData.methodology_type = updateData.methodologyType;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'methodology',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      commited: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Methodology update staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('Error updating methodology:', err);
    res.status(400).json({
      message: 'Error updating methodology',
      error: err.message,
      success: false,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    await assertIfReadOnlyMode();
    await assertHomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    // Verify record exists
    const existingRecord = await MethodologyV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Methodology not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'methodology',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_methodology_id: id }]),
      commited: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Methodology delete staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('Error deleting methodology:', err);
    res.status(400).json({
      message: 'Error deleting methodology',
      error: err.message,
      success: false,
    });
  }
};
