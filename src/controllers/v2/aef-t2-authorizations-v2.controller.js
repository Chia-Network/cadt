'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, AefT2AuthorizationsV2, AefT1SubmissionV2, UnitV2, ProjectV2, AefT5AuthorizedEntitiesV2 } from '../../models/v2/index.js';
import { aefT2AuthorizationsV2Schema } from '../../validations/v2/aef-t2-authorizations-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { convertToSnakeCase } from '../../utils/v2-camel-to-snake.js';
import { loggerV2 } from '../../config/logger.js';

export const createAefT2AuthorizationsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = aefT2AuthorizationsV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new AEF-T2-Authorizations',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new AEF-T2-Authorizations',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustAefT2AuthorizationsId')) {
      return res.status(400).json({
        message: 'Error creating new AEF-T2-Authorizations',
        error: 'cadTrustAefT2AuthorizationsId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys if provided
    try {
      if (newRecord.cadTrustAefT1SubmissionId) {
        await assertRecordExistanceOrStaged(
          AefT1SubmissionV2,
          newRecord.cadTrustAefT1SubmissionId,
          `cadTrustAefT1SubmissionId '${newRecord.cadTrustAefT1SubmissionId}' does not exist. Please create the AEF-T1-Submission first or use a valid cadTrustAefT1SubmissionId`
        );
      }
      if (newRecord.cadTrustUnitId) {
        await assertRecordExistanceOrStaged(
          UnitV2,
          newRecord.cadTrustUnitId,
          `cadTrustUnitId '${newRecord.cadTrustUnitId}' does not exist. Please create the unit first or use a valid cadTrustUnitId`
        );
      }
      if (newRecord.cadTrustProjectId) {
        await assertRecordExistanceOrStaged(
          ProjectV2,
          newRecord.cadTrustProjectId,
          `cadTrustProjectId '${newRecord.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId`
        );
      }
      if (newRecord.cadTrustAefT5AuthorizedEntitiesId) {
        await assertRecordExistanceOrStaged(
          AefT5AuthorizedEntitiesV2,
          newRecord.cadTrustAefT5AuthorizedEntitiesId,
          `cadTrustAefT5AuthorizedEntitiesId '${newRecord.cadTrustAefT5AuthorizedEntitiesId}' does not exist. Please create the AEF-T5-Authorized-Entities first or use a valid cadTrustAefT5AuthorizedEntitiesId`
        );
      }
    } catch (err) {
      return res.status(400).json({
        message: 'Error creating new AEF-T2-Authorizations',
        error: err.message,
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustAefT2AuthorizationsId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_aef_t2_authorizations_id: cadTrustAefT2AuthorizationsId,
      ...convertToSnakeCase(_.omit(newRecord, ['cadTrustAefT2AuthorizationsId', 'createdAt', 'updatedAt'])),
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'aef_t2_authorizations',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T2-Authorizations staged successfully',
      uuid,
      cadTrustAefT2AuthorizationsId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating AEF-T2-Authorizations:', err);
    res.status(400).json({
      message: 'Error creating new AEF-T2-Authorizations',
      error: err.message,
      success: false,
    });
  }
};

export const getAefT2AuthorizationsV2 = async (req, res) => {
  try {
    const { cadTrustAefT2AuthorizationsId } = req.params;

    const aefT2Authorizations = await AefT2AuthorizationsV2.findByPk(cadTrustAefT2AuthorizationsId);

    if (!aefT2Authorizations) {
      return res.status(404).json({
        message: 'AEF-T2-Authorizations not found',
        success: false,
      });
    }

    res.status(200).json(aefT2Authorizations);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching AEF-T2-Authorizations:', err);
    res.status(400).json({
      message: 'Error retrieving AEF-T2-Authorizations',
      error: err.message,
      success: false,
    });
  }
};

export const getAllAefT2AuthorizationsV2 = async (req, res) => {
  try {
    const aefT2Authorizations = await AefT2AuthorizationsV2.findAll({
      order: [['aefT2AuthorizationsDate', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: aefT2Authorizations,
      count: aefT2Authorizations.length,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error fetching AEF-T2-Authorizations:', err);
    res.status(400).json({
      message: 'Error retrieving AEF-T2-Authorizations',
      error: err.message,
      success: false,
    });
  }
};

export const updateAefT2AuthorizationsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustAefT2AuthorizationsId } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation) - check both main table and staging
    try {
      await assertRecordExistanceOrStaged(
        AefT2AuthorizationsV2,
        cadTrustAefT2AuthorizationsId,
        `AEF-T2-Authorizations with ID '${cadTrustAefT2AuthorizationsId}' does not exist`
      );
    } catch (err) {
      return res.status(404).json({
        message: 'AEF-T2-Authorizations not found',
        error: err.message,
        success: false,
      });
    }

    // Validate the request data
    const { error } = aefT2AuthorizationsV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating AEF-T2-Authorizations',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating AEF-T2-Authorizations',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys if provided
    try {
      if (updateData.cadTrustAefT1SubmissionId) {
        await assertRecordExistanceOrStaged(
          AefT1SubmissionV2,
          updateData.cadTrustAefT1SubmissionId,
          `cadTrustAefT1SubmissionId '${updateData.cadTrustAefT1SubmissionId}' does not exist. Please create the AEF-T1-Submission first or use a valid cadTrustAefT1SubmissionId`
        );
      }
      if (updateData.cadTrustUnitId) {
        await assertRecordExistanceOrStaged(
          UnitV2,
          updateData.cadTrustUnitId,
          `cadTrustUnitId '${updateData.cadTrustUnitId}' does not exist. Please create the unit first or use a valid cadTrustUnitId`
        );
      }
      if (updateData.cadTrustProjectId) {
        await assertRecordExistanceOrStaged(
          ProjectV2,
          updateData.cadTrustProjectId,
          `cadTrustProjectId '${updateData.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId`
        );
      }
      if (updateData.cadTrustAefT5AuthorizedEntitiesId) {
        await assertRecordExistanceOrStaged(
          AefT5AuthorizedEntitiesV2,
          updateData.cadTrustAefT5AuthorizedEntitiesId,
          `cadTrustAefT5AuthorizedEntitiesId '${updateData.cadTrustAefT5AuthorizedEntitiesId}' does not exist. Please create the AEF-T5-Authorized-Entities first or use a valid cadTrustAefT5AuthorizedEntitiesId`
        );
      }
    } catch (err) {
      return res.status(400).json({
        message: 'Error updating AEF-T2-Authorizations',
        error: err.message,
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_aef_t2_authorizations_id: cadTrustAefT2AuthorizationsId,
      ...convertToSnakeCase(_.omit(updateData, ['cadTrustAefT2AuthorizationsId', 'createdAt', 'updatedAt'])),
    };

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'aef_t2_authorizations',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T2-Authorizations update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating AEF-T2-Authorizations:', err);
    res.status(400).json({
      message: 'Error updating AEF-T2-Authorizations',
      error: err.message,
      success: false,
    });
  }
};

export const deleteAefT2AuthorizationsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustAefT2AuthorizationsId } = req.params;

    // Verify record exists - check both main table and staging
    try {
      await assertRecordExistanceOrStaged(
        AefT2AuthorizationsV2,
        cadTrustAefT2AuthorizationsId,
        `AEF-T2-Authorizations with ID '${cadTrustAefT2AuthorizationsId}' does not exist`
      );
    } catch (err) {
      return res.status(404).json({
        message: 'AEF-T2-Authorizations not found',
        error: err.message,
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'aef_t2_authorizations',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_aef_t2_authorizations_id: cadTrustAefT2AuthorizationsId }]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T2-Authorizations delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting AEF-T2-Authorizations:', err);
    res.status(400).json({
      message: 'Error deleting AEF-T2-Authorizations',
      error: err.message,
      success: false,
    });
  }
};
