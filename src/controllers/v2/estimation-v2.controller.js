'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, EstimationV2, ProjectV2 } from '../../models/v2/index.js';
import { estimationV2Schema } from '../../validations/v2/estimation-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { loggerV2 } from '../../config/logger.js';

export const createEstimationV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = estimationV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new estimation',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new estimation',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustEstimationId')) {
      return res.status(400).json({
        message: 'Error creating new estimation',
        error: 'cadTrustEstimationId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys
    if (newRecord.cadTrustProjectId) {
      try {
        await assertRecordExistanceOrStaged(
          ProjectV2,
          newRecord.cadTrustProjectId,
          `cadTrustProjectId '${newRecord.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId`
        );
      } catch (err) {
        return res.status(400).json({
          message: 'Error creating new estimation',
          error: err.message,
          success: false,
        });
      }
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustEstimationId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_estimation_id: cadTrustEstimationId,
      estimation_start_date: newRecord.estimationStartDate,
      estimation_end_date: newRecord.estimationEndDate,
      estimation_unit_count: newRecord.estimationUnitCount,
      estimation_reference_no: newRecord.estimationReferenceNo,
      cad_trust_project_id: newRecord.cadTrustProjectId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'estimation',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Estimation staged successfully',
      uuid,
      cadTrustEstimationId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating estimation:', err);
    res.status(400).json({
      message: 'Error creating new estimation',
      error: err.message,
      success: false,
    });
  }
};

export const getEstimationV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimation ID format',
      });
    }

    const estimation = await EstimationV2.findByPk(id);

    if (!estimation) {
      return res.status(404).json({
        success: false,
        message: 'Estimation not found',
      });
    }

    res.json(estimation);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching estimation:', err);
    res.status(400).json({
      message: 'Error retrieving estimation',
      error: err.message,
      success: false,
    });
  }
};

export const getAllEstimationsV2 = async (req, res) => {
  try {
    const estimations = await EstimationV2.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: estimations,
      count: estimations.length,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error fetching estimations:', err);
    res.status(400).json({
      message: 'Error retrieving estimations',
      error: err.message,
      success: false,
    });
  }
};

export const updateEstimationV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await EstimationV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Estimation not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = estimationV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating estimation',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating estimation',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys
    if (updateData.cadTrustProjectId) {
      try {
        await assertRecordExistanceOrStaged(
          ProjectV2,
          updateData.cadTrustProjectId,
          `cadTrustProjectId '${updateData.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId`
        );
      } catch (err) {
        return res.status(400).json({
          message: 'Error updating estimation',
          error: err.message,
          success: false,
        });
      }
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_estimation_id: id, // Use UUID string directly
    };

    if (updateData.estimationStartDate !== undefined) dbUpdateData.estimation_start_date = updateData.estimationStartDate;
    if (updateData.estimationEndDate !== undefined) dbUpdateData.estimation_end_date = updateData.estimationEndDate;
    if (updateData.estimationUnitCount !== undefined) dbUpdateData.estimation_unit_count = updateData.estimationUnitCount;
    if (updateData.estimationReferenceNo !== undefined) dbUpdateData.estimation_reference_no = updateData.estimationReferenceNo;
    if (updateData.cadTrustProjectId !== undefined) dbUpdateData.cad_trust_project_id = updateData.cadTrustProjectId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'estimation',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Estimation update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating estimation:', err);
    res.status(400).json({
      message: 'Error updating estimation',
      error: err.message,
      success: false,
    });
  }
};

export const deleteEstimationV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    // Verify record exists
    const existingRecord = await EstimationV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Estimation not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'estimation',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_estimation_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Estimation delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting estimation:', err);
    res.status(400).json({
      message: 'Error deleting estimation',
      error: err.message,
      success: false,
    });
  }
};
