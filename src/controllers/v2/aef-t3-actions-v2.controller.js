'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, AefT3ActionsV2, AefT1SubmissionV2, UnitV2, ProjectV2, AefT2AuthorizationsV2 } from '../../models/v2/index.js';
import { aefT3ActionsV2Schema } from '../../validations/v2/aef-t3-actions-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { convertToSnakeCase } from '../../utils/v2-camel-to-snake.js';
import { loggerV2 } from '../../config/logger.js';

export const createAefT3ActionsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = aefT3ActionsV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new AEF-T3-Actions',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new AEF-T3-Actions',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustAefT3ActionsId')) {
      return res.status(400).json({
        message: 'Error creating new AEF-T3-Actions',
        error: 'cadTrustAefT3ActionsId is auto-generated and cannot be set via API',
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
      if (newRecord.cadTrustAefT2AuthorizationsId) {
        await assertRecordExistanceOrStaged(
          AefT2AuthorizationsV2,
          newRecord.cadTrustAefT2AuthorizationsId,
          `cadTrustAefT2AuthorizationsId '${newRecord.cadTrustAefT2AuthorizationsId}' does not exist. Please create the AEF-T2-Authorizations first or use a valid cadTrustAefT2AuthorizationsId`
        );
      }
    } catch (err) {
      return res.status(400).json({
        message: 'Error creating new AEF-T3-Actions',
        error: err.message,
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustAefT3ActionsId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_aef_t3_actions_id: cadTrustAefT3ActionsId,
      ...convertToSnakeCase(_.omit(newRecord, ['cadTrustAefT3ActionsId', 'createdAt', 'updatedAt'])),
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'aef_t3_actions',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T3-Actions staged successfully',
      uuid,
      cadTrustAefT3ActionsId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating AEF-T3-Actions:', err);
    res.status(400).json({
      message: 'Error creating new AEF-T3-Actions',
      error: err.message,
      success: false,
    });
  }
};

export const getAefT3ActionsV2 = async (req, res) => {
  try {
    const { cadTrustAefT3ActionsId } = req.params;

    const aefT3Actions = await AefT3ActionsV2.findByPk(cadTrustAefT3ActionsId);

    if (!aefT3Actions) {
      return res.status(404).json({
        message: 'AEF-T3-Actions not found',
        success: false,
      });
    }

    res.status(200).json(aefT3Actions);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching AEF-T3-Actions:', err);
    res.status(400).json({
      message: 'Error retrieving AEF-T3-Actions',
      error: err.message,
      success: false,
    });
  }
};

export const getAllAefT3ActionsV2 = async (req, res) => {
  try {
    const aefT3Actions = await AefT3ActionsV2.findAll({
      order: [['aefT3ActionsDate', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: aefT3Actions,
      count: aefT3Actions.length,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error fetching AEF-T3-Actions:', err);
    res.status(400).json({
      message: 'Error retrieving AEF-T3-Actions',
      error: err.message,
      success: false,
    });
  }
};

export const updateAefT3ActionsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustAefT3ActionsId } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation) - check both main table and staging
    try {
      await assertRecordExistanceOrStaged(
        AefT3ActionsV2,
        cadTrustAefT3ActionsId,
        `AEF-T3-Actions with ID '${cadTrustAefT3ActionsId}' does not exist`
      );
    } catch (err) {
      return res.status(404).json({
        message: 'AEF-T3-Actions not found',
        error: err.message,
        success: false,
      });
    }

    // Validate the request data
    const { error } = aefT3ActionsV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating AEF-T3-Actions',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating AEF-T3-Actions',
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
      if (updateData.cadTrustAefT2AuthorizationsId) {
        await assertRecordExistanceOrStaged(
          AefT2AuthorizationsV2,
          updateData.cadTrustAefT2AuthorizationsId,
          `cadTrustAefT2AuthorizationsId '${updateData.cadTrustAefT2AuthorizationsId}' does not exist. Please create the AEF-T2-Authorizations first or use a valid cadTrustAefT2AuthorizationsId`
        );
      }
    } catch (err) {
      return res.status(400).json({
        message: 'Error updating AEF-T3-Actions',
        error: err.message,
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_aef_t3_actions_id: cadTrustAefT3ActionsId,
      ...convertToSnakeCase(_.omit(updateData, ['cadTrustAefT3ActionsId', 'createdAt', 'updatedAt'])),
    };

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'aef_t3_actions',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T3-Actions update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating AEF-T3-Actions:', err);
    res.status(400).json({
      message: 'Error updating AEF-T3-Actions',
      error: err.message,
      success: false,
    });
  }
};

export const deleteAefT3ActionsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustAefT3ActionsId } = req.params;

    // Verify record exists - check both main table and staging
    try {
      await assertRecordExistanceOrStaged(
        AefT3ActionsV2,
        cadTrustAefT3ActionsId,
        `AEF-T3-Actions with ID '${cadTrustAefT3ActionsId}' does not exist`
      );
    } catch (err) {
      return res.status(404).json({
        message: 'AEF-T3-Actions not found',
        error: err.message,
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'aef_t3_actions',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_aef_t3_actions_id: cadTrustAefT3ActionsId }]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T3-Actions delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting AEF-T3-Actions:', err);
    res.status(400).json({
      message: 'Error deleting AEF-T3-Actions',
      error: err.message,
      success: false,
    });
  }
};
