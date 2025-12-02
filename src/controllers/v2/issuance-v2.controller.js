'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, IssuanceV2, VerificationV2, MethodologyV2, OrganizationsV2 } from '../../models/v2/index.js';

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
import { issuanceV2Schema } from '../../validations/v2/issuance-v2.validations.js';

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = issuanceV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustIssuanceId')) {
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: 'cadTrustIssuanceId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustIssuanceId')) {
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: 'cadTrustIssuanceId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys
    await assertRecordExistanceOrStaged(VerificationV2, newRecord.cadTrustVerificationId);
    await assertRecordExistanceOrStaged(MethodologyV2, newRecord.cadTrustMethodologyId);

    if (newRecord.cadTrustLocationId) {
      // Note: LocationV2 validation will be added when Location endpoint is implemented
      // await assertRecordExistanceOrStaged(LocationV2, newRecord.cadTrustLocationId);
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_issuance_id: uuidv4(), // Generate UUID for primary key
      issuance_id: newRecord.issuanceId,
      issuance_date: newRecord.issuanceDate,
      cad_trust_verification_id: newRecord.cadTrustVerificationId,
      cad_trust_methodology_id: newRecord.cadTrustMethodologyId,
      cad_trust_location_id: newRecord.cadTrustLocationId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'issuance',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Issuance staged successfully',
      uuid,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating issuance:', err);
    res.status(400).json({
      message: 'Error creating new issuance',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pagination = paginationParams(page, limit);

    const records = await IssuanceV2.findAndCountAll({
      ...pagination,
      include: [
        {
          model: VerificationV2,
          as: 'verification',
          required: false,
        },
        {
          model: MethodologyV2,
          as: 'methodology',
          required: false,
        },
        // Note: LocationV2 include will be added when Location endpoint is implemented
      ],
    });

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving issuances:', err);
    res.status(400).json({
      message: 'Error retrieving issuances',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await IssuanceV2.findByPk(id, {
      include: [
        {
          model: VerificationV2,
          as: 'verification',
          required: false,
        },
        {
          model: MethodologyV2,
          as: 'methodology',
          required: false,
        },
        // Note: LocationV2 include will be added when Location endpoint is implemented
      ],
    });

    if (!record) {
      return res.status(404).json({
        message: 'Issuance not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving issuance:', err);
    res.status(400).json({
      message: 'Error retrieving issuance',
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
    const existingRecord = await IssuanceV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Issuance not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = issuanceV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error updating issuance',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating issuance',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys
    await assertRecordExistanceOrStaged(VerificationV2, updateData.cadTrustVerificationId);
    await assertRecordExistanceOrStaged(MethodologyV2, updateData.cadTrustMethodologyId);

    if (updateData.cadTrustLocationId) {
      // Note: LocationV2 validation will be added when Location endpoint is implemented
      // await assertRecordExistanceOrStaged(LocationV2, updateData.cadTrustLocationId);
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_issuance_id: id, // Use UUID string directly
    };

    if (updateData.issuanceId !== undefined) dbUpdateData.issuance_id = updateData.issuanceId;
    if (updateData.issuanceDate !== undefined) dbUpdateData.issuance_date = updateData.issuanceDate;
    if (updateData.cadTrustVerificationId !== undefined) dbUpdateData.cad_trust_verification_id = updateData.cadTrustVerificationId;
    if (updateData.cadTrustMethodologyId !== undefined) dbUpdateData.cad_trust_methodology_id = updateData.cadTrustMethodologyId;
    if (updateData.cadTrustLocationId !== undefined) dbUpdateData.cad_trust_location_id = updateData.cadTrustLocationId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'issuance',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Issuance update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating issuance:', err);
    res.status(400).json({
      message: 'Error updating issuance',
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
    const existingRecord = await IssuanceV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Issuance not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'issuance',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_issuance_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Issuance delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting issuance:', err);
    res.status(400).json({
      message: 'Error deleting issuance',
      error: err.message,
      success: false,
    });
  }
};
