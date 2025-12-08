'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, VerificationV2, ProjectV2, ValidationV2, OrganizationsV2 } from '../../models/v2/index.js';

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

import { loggerV2 } from '../../config/logger.js';
import { verificationV2Schema } from '../../validations/v2/verification-v2.validations.js';

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = verificationV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error creating new verification',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new verification',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustVerificationId')) {
      return res.status(400).json({
        message: 'Error creating new verification',
        error: 'cadTrustVerificationId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustVerificationId')) {
      return res.status(400).json({
        message: 'Error creating new verification',
        error: 'cadTrustVerificationId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys
    await assertRecordExistanceOrStaged(ProjectV2, newRecord.cadTrustProjectId);

    if (newRecord.cadTrustValidationId) {
      await assertRecordExistanceOrStaged(ValidationV2, newRecord.cadTrustValidationId);
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustVerificationId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_verification_id: cadTrustVerificationId,
      verification_id: newRecord.verificationId,
      verification_start_date: newRecord.verificationStartDate,
      verification_end_date: newRecord.verificationEndDate,
      verification_body: newRecord.verificationBody,
      cad_trust_project_id: newRecord.cadTrustProjectId,
      cad_trust_validation_id: newRecord.cadTrustValidationId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'verification',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Verification staged successfully',
      uuid,
      cadTrustVerificationId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating verification:', err);
    res.status(400).json({
      message: 'Error creating new verification',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pagination = paginationParams(page, limit);

    const records = await VerificationV2.findAndCountAll({
      ...pagination,
      include: [
        {
          model: ProjectV2,
          as: 'project',
          required: false,
        },
        {
          model: ValidationV2,
          as: 'validation',
          required: false,
        },
      ],
    });

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving verifications:', err);
    res.status(400).json({
      message: 'Error retrieving verifications',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await VerificationV2.findByPk(id, {
      include: [
        {
          model: ProjectV2,
          as: 'project',
          required: false,
        },
        {
          model: ValidationV2,
          as: 'validation',
          required: false,
        },
      ],
    });

    if (!record) {
      return res.status(404).json({
        message: 'Verification not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving verification:', err);
    res.status(400).json({
      message: 'Error retrieving verification',
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
    const existingRecord = await VerificationV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Verification not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = verificationV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error updating verification',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating verification',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys
    await assertRecordExistanceOrStaged(ProjectV2, updateData.cadTrustProjectId);

    if (updateData.cadTrustValidationId) {
      await assertRecordExistanceOrStaged(ValidationV2, updateData.cadTrustValidationId);
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_verification_id: id, // Use UUID string directly
    };

    if (updateData.verificationId !== undefined) dbUpdateData.verification_id = updateData.verificationId;
    if (updateData.verificationStartDate !== undefined) dbUpdateData.verification_start_date = updateData.verificationStartDate;
    if (updateData.verificationEndDate !== undefined) dbUpdateData.verification_end_date = updateData.verificationEndDate;
    if (updateData.verificationBody !== undefined) dbUpdateData.verification_body = updateData.verificationBody;
    if (updateData.cadTrustProjectId !== undefined) dbUpdateData.cad_trust_project_id = updateData.cadTrustProjectId;
    if (updateData.cadTrustValidationId !== undefined) dbUpdateData.cad_trust_validation_id = updateData.cadTrustValidationId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'verification',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Verification update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating verification:', err);
    res.status(400).json({
      message: 'Error updating verification',
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
    const existingRecord = await VerificationV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Verification not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'verification',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_verification_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Verification delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting verification:', err);
    res.status(400).json({
      message: 'Error deleting verification',
      error: err.message,
      success: false,
    });
  }
};
