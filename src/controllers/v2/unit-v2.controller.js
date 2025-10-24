'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, UnitV2, IssuanceV2, OrganizationsV2 } from '../../models/v2/index.js';

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

import { logger } from '../../config/logger.js';
import { unitV2Schema } from '../../validations/v2/unit-v2.validations.js';

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = unitV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustUnitId')) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: 'cadTrustUnitId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustUnitId')) {
      return res.status(400).json({
        message: 'Error creating new unit',
        error: 'cadTrustUnitId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys
    await assertRecordExistanceOrStaged(IssuanceV2, newRecord.cadTrustIssuanceId);

    // Generate UUID for staging
    const uuid = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_unit_id: uuidv4(), // Generate UUID for primary key
      unit_serial_id: newRecord.unitSerialId,
      unit_start_block: newRecord.unitStartBlock,
      unit_end_block: newRecord.unitEndBlock,
      unit_count: newRecord.unitCount,
      unit_type: newRecord.unitType,
      unit_vintage_year: newRecord.unitVintageYear,
      unit_status: newRecord.unitStatus,
      unit_status_reason: newRecord.unitStatusReason,
      unit_status_date: newRecord.unitStatusDate,
      unit_retirement_detail: newRecord.unitRetirementDetail,
      unit_retirement_beneficiary: newRecord.unitRetirementBeneficiary,
      unit_retirement_beneficiary_id: newRecord.unitRetirementBeneficiaryId,
      unit_link: newRecord.unitLink,
      unit_metric: newRecord.unitMetric,
      unit_current_owner: newRecord.unitCurrentOwner,
      unit_itmos_reference_id: newRecord.unitItmosReferenceId,
      cad_trust_issuance_id: newRecord.cadTrustIssuanceId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'unit',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      commited: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit staged successfully',
      uuid,
      success: true,
    });
  } catch (err) {
    logger.error('Error creating unit:', err);
    res.status(400).json({
      message: 'Error creating new unit',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pagination = paginationParams(page, limit);

    const records = await UnitV2.findAndCountAll({
      ...pagination,
      include: [
        {
          model: IssuanceV2,
          as: 'issuance',
          required: false,
        },
      ],
    });

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    logger.error('Error retrieving units:', err);
    res.status(400).json({
      message: 'Error retrieving units',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await UnitV2.findByPk(id, {
      include: [
        {
          model: IssuanceV2,
          as: 'issuance',
          required: false,
        },
      ],
    });

    if (!record) {
      return res.status(404).json({
        message: 'Unit not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    logger.error('Error retrieving unit:', err);
    res.status(400).json({
      message: 'Error retrieving unit',
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
    const existingRecord = await UnitV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Unit not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = unitV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error updating unit',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating unit',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys
    await assertRecordExistanceOrStaged(IssuanceV2, updateData.cadTrustIssuanceId);

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_unit_id: id, // Use UUID string directly
    };

    if (updateData.unitSerialId !== undefined) dbUpdateData.unit_serial_id = updateData.unitSerialId;
    if (updateData.unitStartBlock !== undefined) dbUpdateData.unit_start_block = updateData.unitStartBlock;
    if (updateData.unitEndBlock !== undefined) dbUpdateData.unit_end_block = updateData.unitEndBlock;
    if (updateData.unitCount !== undefined) dbUpdateData.unit_count = updateData.unitCount;
    if (updateData.unitType !== undefined) dbUpdateData.unit_type = updateData.unitType;
    if (updateData.unitVintageYear !== undefined) dbUpdateData.unit_vintage_year = updateData.unitVintageYear;
    if (updateData.unitStatus !== undefined) dbUpdateData.unit_status = updateData.unitStatus;
    if (updateData.unitStatusReason !== undefined) dbUpdateData.unit_status_reason = updateData.unitStatusReason;
    if (updateData.unitStatusDate !== undefined) dbUpdateData.unit_status_date = updateData.unitStatusDate;
    if (updateData.unitRetirementDetail !== undefined) dbUpdateData.unit_retirement_detail = updateData.unitRetirementDetail;
    if (updateData.unitRetirementBeneficiary !== undefined) dbUpdateData.unit_retirement_beneficiary = updateData.unitRetirementBeneficiary;
    if (updateData.unitRetirementBeneficiaryId !== undefined) dbUpdateData.unit_retirement_beneficiary_id = updateData.unitRetirementBeneficiaryId;
    if (updateData.unitLink !== undefined) dbUpdateData.unit_link = updateData.unitLink;
    if (updateData.unitMetric !== undefined) dbUpdateData.unit_metric = updateData.unitMetric;
    if (updateData.unitCurrentOwner !== undefined) dbUpdateData.unit_current_owner = updateData.unitCurrentOwner;
    if (updateData.unitItmosReferenceId !== undefined) dbUpdateData.unit_itmos_reference_id = updateData.unitItmosReferenceId;
    if (updateData.cadTrustIssuanceId !== undefined) dbUpdateData.cad_trust_issuance_id = updateData.cadTrustIssuanceId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'unit',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      commited: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit update staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('Error updating unit:', err);
    res.status(400).json({
      message: 'Error updating unit',
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
    const existingRecord = await UnitV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Unit not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'unit',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_unit_id: id }]), // Use UUID string directly
      commited: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit delete staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('Error deleting unit:', err);
    res.status(400).json({
      message: 'Error deleting unit',
      error: err.message,
      success: false,
    });
  }
};
