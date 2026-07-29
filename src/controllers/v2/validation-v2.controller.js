'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, ValidationV2, ProjectV2 } from '../../models/v2/index.js';

import {
  optionallyPaginatedResponse,
  paginationParams,
} from '../../utils/helpers';

import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';

import { loggerV2 } from '../../config/logger.js';
import { validationV2Schema } from '../../validations/v2/validation-v2.validations.js';
import { checkReferences, buildReferenceConflictBody } from '../../utils/v2-reference-guards.js';

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    const homeOrg = await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = validationV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new validation',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new validation',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustValidationId')) {
      return res.status(400).json({
        message: 'Error creating new validation',
        error: 'cadTrustValidationId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustValidationId')) {
      return res.status(400).json({
        message: 'Error creating new validation',
        error: 'cadTrustValidationId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign key
    try {
      await assertRecordExistanceOrStaged(ProjectV2, newRecord.cadTrustProjectId, 'cadTrustProjectId');
    } catch (err) {
      return res.status(400).json({
        message: 'Error creating new validation',
        error: err.message,
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustValidationId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_validation_id: cadTrustValidationId,
      validation_id: newRecord.validationId,
      validation_type: newRecord.validationType,
      validation_body: newRecord.validationBody,
      validation_date: newRecord.validationDate,
      validation_credit_period_start_date: newRecord.validationCreditPeriodStartDate,
      validation_credit_period_end_date: newRecord.validationCreditPeriodEndDate,
      cad_trust_project_id: newRecord.cadTrustProjectId,
      created_by_org_uid: homeOrg.org_uid,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'validation',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Validation staged successfully',
      uuid,
      cadTrustValidationId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating validation:', err);
    res.status(400).json({
      message: 'Error creating new validation',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    const { page, limit, columns, orgUid, createdByOrgUid } = req.query;
    const pagination = paginationParams(page, limit);
    const resolvedOrgUid = await resolveOrgUid(orgUid);
    const resolvedCreatedByOrgUid = await resolveOrgUid(createdByOrgUid);

    // Handle association includes
    let queryIncludes = [];
    const columnsArray = columns
      ? (Array.isArray(columns) ? columns : columns.split(',').map(c => c.trim()))
      : [];
    const includeProject = columnsArray.includes('project') || columnsArray.includes('ProjectV2');

    if (resolvedOrgUid || includeProject) {
      queryIncludes.push({
        model: ProjectV2,
        as: 'project',
        attributes: includeProject ? undefined : [],
        where: resolvedOrgUid ? { orgUid: resolvedOrgUid } : undefined,
        required: !!resolvedOrgUid,
      });
    }

    const whereClause = {};
    if (resolvedCreatedByOrgUid) {
      whereClause.createdByOrgUid = resolvedCreatedByOrgUid;
    }

    const records = await ValidationV2.findAndCountAll({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: queryIncludes.length > 0 ? queryIncludes : undefined,
      ...pagination,
    });

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving validations:', err);
    res.status(400).json({
      message: 'Error retrieving validations',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const { columns } = req.query;

    // Handle association includes
    let queryIncludes = [];
    if (columns) {
      const columnsArray = Array.isArray(columns) ? columns : columns.split(',').map(c => c.trim());
      if (columnsArray.includes('project') || columnsArray.includes('ProjectV2')) {
        queryIncludes.push({
          model: ProjectV2,
          as: 'project',
          required: false,
        });
      }
    }

    const record = await ValidationV2.findByPk(id, {
      include: queryIncludes.length > 0 ? queryIncludes : undefined,
    });

    if (!record) {
      return res.status(404).json({
        message: 'Validation not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving validation:', err);
    res.status(400).json({
      message: 'Error retrieving validation',
      error: err.message,
      success: false,
    });
  }
};

export const update = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await ValidationV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Validation not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = validationV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating validation',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating validation',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign key
    await assertRecordExistanceOrStaged(ProjectV2, updateData.cadTrustProjectId, 'cadTrustProjectId');

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_validation_id: id, // Use UUID string directly
    };

    if (updateData.validationId !== undefined) dbUpdateData.validation_id = updateData.validationId;
    if (updateData.validationType !== undefined) dbUpdateData.validation_type = updateData.validationType;
    if (updateData.validationBody !== undefined) dbUpdateData.validation_body = updateData.validationBody;
    if (updateData.validationDate !== undefined) dbUpdateData.validation_date = updateData.validationDate;
    if (updateData.validationCreditPeriodStartDate !== undefined) dbUpdateData.validation_credit_period_start_date = updateData.validationCreditPeriodStartDate;
    if (updateData.validationCreditPeriodEndDate !== undefined) dbUpdateData.validation_credit_period_end_date = updateData.validationCreditPeriodEndDate;
    if (updateData.cadTrustProjectId !== undefined) dbUpdateData.cad_trust_project_id = updateData.cadTrustProjectId;
    if (existingRecord?.createdByOrgUid) {
      dbUpdateData.created_by_org_uid = existingRecord.createdByOrgUid;
    }

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'validation',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Validation update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating validation:', err);
    res.status(400).json({
      message: 'Error updating validation',
      error: err.message,
      success: false,
    });
  }
};

export const destroy = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    // Verify record exists
    const existingRecord = await ValidationV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Validation not found',
        success: false,
      });
    }

    const refResult = await checkReferences('validation', id);
    if (refResult.hasReferences) {
      return res.status(409).json(buildReferenceConflictBody('validation', refResult));
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'validation',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_validation_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Validation delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting validation:', err);
    res.status(400).json({
      message: 'Error deleting validation',
      error: err.message,
      success: false,
    });
  }
};
