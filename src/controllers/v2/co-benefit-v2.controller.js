'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, CoBenefitV2, ProjectV2 } from '../../models/v2/index.js';
import { coBenefitV2Schema } from '../../validations/v2/co-benefit-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { loggerV2 } from '../../config/logger.js';

export const createCoBenefitV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = coBenefitV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new co-benefit',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new co-benefit',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustCoBenefitId')) {
      return res.status(400).json({
        message: 'Error creating new co-benefit',
        error: 'cadTrustCoBenefitId is auto-generated and cannot be set via API',
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
          message: 'Error creating new co-benefit',
          error: err.message,
          success: false,
        });
      }
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustCoBenefitId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_co_benefit_id: cadTrustCoBenefitId,
      co_benefit_id: newRecord.coBenefitId,
      cad_trust_project_id: newRecord.cadTrustProjectId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'co_benefit',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Co-Benefit staged successfully',
      uuid,
      cadTrustCoBenefitId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating co-benefit:', err);
    res.status(400).json({
      message: 'Error creating new co-benefit',
      error: err.message,
      success: false,
    });
  }
};

export const getCoBenefitV2 = async (req, res) => {
  try {
    const { id } = req.params;

    const coBenefit = await CoBenefitV2.findByPk(id);

    if (!coBenefit) {
      return res.status(404).json({
        message: 'Co-Benefit not found',
        success: false,
      });
    }

    res.status(200).json(coBenefit);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching co-benefit:', err);
    res.status(400).json({
      message: 'Error retrieving co-benefit',
      error: err.message,
      success: false,
    });
  }
};

export const getAllCoBenefitsV2 = async (req, res) => {
  try {
    const coBenefits = await CoBenefitV2.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: coBenefits,
      count: coBenefits.length,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error fetching co-benefits:', err);
    res.status(400).json({
      message: 'Error retrieving co-benefits',
      error: err.message,
      success: false,
    });
  }
};

export const updateCoBenefitV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await CoBenefitV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Co-Benefit not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = coBenefitV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating co-benefit',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating co-benefit',
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
          message: 'Error updating co-benefit',
          error: err.message,
          success: false,
        });
      }
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_co_benefit_id: id, // Use UUID string directly
    };

    if (updateData.coBenefitId !== undefined) dbUpdateData.co_benefit_id = updateData.coBenefitId;
    if (updateData.cadTrustProjectId !== undefined) dbUpdateData.cad_trust_project_id = updateData.cadTrustProjectId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'co_benefit',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Co-Benefit update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating co-benefit:', err);
    res.status(400).json({
      message: 'Error updating co-benefit',
      error: err.message,
      success: false,
    });
  }
};

export const deleteCoBenefitV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    // Verify record exists
    const existingRecord = await CoBenefitV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Co-Benefit not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'co_benefit',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_co_benefit_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Co-Benefit delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting co-benefit:', err);
    res.status(400).json({
      message: 'Error deleting co-benefit',
      error: err.message,
      success: false,
    });
  }
};
