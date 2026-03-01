'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, UnitLabelV2, LabelV2, UnitV2 } from '../../models/v2/index.js';
import { unitLabelV2Schema } from '../../validations/v2/unit-label-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';
import { paginationParams, optionallyPaginatedResponse } from '../../utils/helpers.js';
import { loggerV2 } from '../../config/logger.js';

export const createUnitLabelV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Check for forbidden fields BEFORE Joi validation
    // This ensures we return custom error messages instead of Joi's "not allowed" message
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new unit-label relationship',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustUnitLabelId')) {
      return res.status(400).json({
        message: 'Error creating new unit-label relationship',
        error: 'cadTrustUnitLabelId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate the request data
    const { error } = unitLabelV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new unit-label relationship',
        error: errorMessage,
        success: false,
      });
    }

    // Validate foreign keys: Both Label and Unit must exist
    try {
      await assertRecordExistanceOrStaged(
        LabelV2,
        newRecord.cadTrustLabelId,
        `cadTrustLabelId '${newRecord.cadTrustLabelId}' does not exist. Please create the label first or use a valid cadTrustLabelId`
      );
      await assertRecordExistanceOrStaged(
        UnitV2,
        newRecord.cadTrustUnitId,
        `cadTrustUnitId '${newRecord.cadTrustUnitId}' does not exist. Please create the unit first or use a valid cadTrustUnitId`
      );
    } catch (err) {
      return res.status(400).json({
        message: 'Error creating new unit-label relationship',
        error: err.message,
        success: false,
      });
    }

    // Check if the relationship already exists (in main table or staging)
    // Wrap in try-catch to handle cases where table/column might not exist yet
    let existingRelation = null;
    try {
      existingRelation = await UnitLabelV2.findOne({
        where: {
          cadTrustLabelId: newRecord.cadTrustLabelId,
          cadTrustUnitId: newRecord.cadTrustUnitId,
        },
      });
    } catch (error) {
      // If table/column doesn't exist, continue (will check staging table below)
      // Only catch "no such column" errors - re-throw other database errors
      if (!error.message || !error.message.includes('no such column')) {
        throw error;
      }
      // Table exists but column doesn't - likely migration issue, but continue
    }

    if (existingRelation) {
      return res.status(409).json({
        message: 'Error creating new unit-label relationship',
        error: 'Unit-Label relationship already exists',
        success: false,
      });
    }

    // Check staging table for pending inserts
    const stagingRecords = await StagingV2.findAll({
      where: {
        table: 'unit_label',
        action: 'INSERT',
        committed: false,
      },
    });

    for (const stagingRecord of stagingRecords) {
      try {
        const stagedData = JSON.parse(stagingRecord.data);
        const recordsToCheck = Array.isArray(stagedData) ? stagedData : [stagedData];
        for (const record of recordsToCheck) {
          if (
            record.cad_trust_label_id === newRecord.cadTrustLabelId &&
            record.cad_trust_unit_id === newRecord.cadTrustUnitId
          ) {
            return res.status(409).json({
              message: 'Error creating new unit-label relationship',
              error: 'Unit-Label relationship already exists in staging',
              success: false,
            });
          }
        }
      } catch (parseError) {
        continue;
      }
    }

    // Generate UUID for the primary key
    const cadTrustUnitLabelId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_unit_label_id: cadTrustUnitLabelId,
      cad_trust_label_id: newRecord.cadTrustLabelId,
      cad_trust_unit_id: newRecord.cadTrustUnitId,
      label_unit_date: newRecord.labelUnitDate,
      label_unit_description: newRecord.labelUnitDescription,
    };

    // Stage the record
    await StagingV2.create({
      uuid: cadTrustUnitLabelId,
      table: 'unit_label',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit-Label relationship staged successfully',
      uuid: cadTrustUnitLabelId,
      cadTrustUnitLabelId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating unit-label relationship:', err);
    res.status(400).json({
      message: 'Error creating new unit-label relationship',
      error: err.message,
      success: false,
    });
  }
};

export const getUnitLabelV2 = async (req, res) => {
  try {
    const { cadTrustUnitLabelId } = req.params;

    const unitLabel = await UnitLabelV2.findOne({
      where: {
        cadTrustUnitLabelId,
      },
    });

    if (!unitLabel) {
      return res.status(404).json({
        message: 'Unit-Label relationship not found',
        success: false,
      });
    }

    res.status(200).json(unitLabel);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching unit-label relationship:', err);
    res.status(400).json({
      message: 'Error retrieving unit-label relationship',
      error: err.message,
      success: false,
    });
  }
};

export const getAllUnitLabelsV2 = async (req, res) => {
  try {
    const { page, limit, orgUid } = req.query;
    const pagination = paginationParams(page, limit);
    const resolvedOrgUid = await resolveOrgUid(orgUid);

    const queryOptions = { distinct: true, order: [['createdAt', 'DESC']], ...pagination };
    if (resolvedOrgUid) {
      queryOptions.include = [{
        model: UnitV2,
        as: 'unit',
        attributes: [],
        where: { orgUid: resolvedOrgUid },
        required: true,
      }];
    }

    const records = await UnitLabelV2.findAndCountAll(queryOptions);

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error fetching unit-label relationships:', err);
    res.status(400).json({
      message: 'Error retrieving unit-label relationships',
      error: err.message,
      success: false,
    });
  }
};

export const updateUnitLabelV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustUnitLabelId } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await UnitLabelV2.findOne({
      where: {
        cadTrustUnitLabelId,
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        message: 'Unit-Label relationship not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = unitLabelV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating unit-label relationship',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating unit-label relationship',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys if they're being changed
    if (updateData.cadTrustLabelId !== existingRecord.cadTrustLabelId || updateData.cadTrustUnitId !== existingRecord.cadTrustUnitId) {
      try {
        if (updateData.cadTrustLabelId) {
          await assertRecordExistanceOrStaged(
            LabelV2,
            updateData.cadTrustLabelId,
            `cadTrustLabelId '${updateData.cadTrustLabelId}' does not exist. Please create the label first or use a valid cadTrustLabelId`
          );
        }
        if (updateData.cadTrustUnitId) {
          await assertRecordExistanceOrStaged(
            UnitV2,
            updateData.cadTrustUnitId,
            `cadTrustUnitId '${updateData.cadTrustUnitId}' does not exist. Please create the unit first or use a valid cadTrustUnitId`
          );
        }
      } catch (err) {
        return res.status(400).json({
          message: 'Error updating unit-label relationship',
          error: err.message,
          success: false,
        });
      }
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_unit_label_id: cadTrustUnitLabelId,
    };

    if (updateData.cadTrustLabelId !== undefined) dbUpdateData.cad_trust_label_id = updateData.cadTrustLabelId;
    if (updateData.cadTrustUnitId !== undefined) dbUpdateData.cad_trust_unit_id = updateData.cadTrustUnitId;
    if (updateData.labelUnitDate !== undefined) dbUpdateData.label_unit_date = updateData.labelUnitDate;
    if (updateData.labelUnitDescription !== undefined) dbUpdateData.label_unit_description = updateData.labelUnitDescription;

    // Stage the update
    await StagingV2.create({
      uuid: cadTrustUnitLabelId,
      table: 'unit_label',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit-Label relationship update staged successfully',
      cadTrustUnitLabelId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating unit-label relationship:', err);
    res.status(400).json({
      message: 'Error updating unit-label relationship',
      error: err.message,
      success: false,
    });
  }
};

export const deleteUnitLabelV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustUnitLabelId } = req.params;

    // Verify record exists
    const existingRecord = await UnitLabelV2.findOne({
      where: {
        cadTrustUnitLabelId,
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        message: 'Unit-Label relationship not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: cadTrustUnitLabelId,
      table: 'unit_label',
      action: 'DELETE',
      data: JSON.stringify([{
        cad_trust_unit_label_id: cadTrustUnitLabelId,
      }]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Unit-Label relationship delete staged successfully',
      cadTrustUnitLabelId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting unit-label relationship:', err);
    res.status(400).json({
      message: 'Error deleting unit-label relationship',
      error: err.message,
      success: false,
    });
  }
};
