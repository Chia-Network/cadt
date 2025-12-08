'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, AefT5AuthorizedEntitiesV2, AefT1SubmissionV2, UnitV2, ProjectV2 } from '../../models/v2/index.js';
import { aefT5AuthorizedEntitiesV2Schema } from '../../validations/v2/aef-t5-authorized-entities-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { convertToSnakeCase } from '../../utils/v2-camel-to-snake.js';
import { loggerV2 } from '../../config/logger.js';

export const createAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = aefT5AuthorizedEntitiesV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new AEF-T5-Authorized-Entities',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new AEF-T5-Authorized-Entities',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustAefT5AuthorizedEntitiesId')) {
      return res.status(400).json({
        message: 'Error creating new AEF-T5-Authorized-Entities',
        error: 'cadTrustAefT5AuthorizedEntitiesId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys if provided
    try {
      if (newRecord.cadTrustAefT1SubmissionId) {
        await assertRecordExistanceOrStaged(
          AefT1SubmissionV2,
          newRecord.cadTrustAefT1SubmissionId,
          `cadTrustAefT1SubmissionId '${newRecord.cadTrustAefT1SubmissionId}' does not exist. Please create the AEF-T1-Submission first or use a valid cadTrustAefT1SubmissionId.`
        );
      }
      if (newRecord.cadTrustUnitId) {
        await assertRecordExistanceOrStaged(
          UnitV2,
          newRecord.cadTrustUnitId,
          `cadTrustUnitId '${newRecord.cadTrustUnitId}' does not exist. Please create the unit first or use a valid cadTrustUnitId.`
        );
      }
      if (newRecord.cadTrustProjectId) {
        await assertRecordExistanceOrStaged(
          ProjectV2,
          newRecord.cadTrustProjectId,
          `cadTrustProjectId '${newRecord.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId.`
        );
      }
    } catch (err) {
      return res.status(400).json({
        message: 'Error creating new AEF-T5-Authorized-Entities',
        error: err.message,
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustAefT5AuthorizedEntitiesId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_aef_t5_authorized_entities_id: cadTrustAefT5AuthorizedEntitiesId,
      ...convertToSnakeCase(_.omit(newRecord, ['cadTrustAefT5AuthorizedEntitiesId', 'createdAt', 'updatedAt'])),
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'aef_t5_authorized_entities',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T5-Authorized-Entities staged successfully',
      uuid,
      cadTrustAefT5AuthorizedEntitiesId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating AEF-T5-Authorized-Entities:', err);
    res.status(400).json({
      message: 'Error creating new AEF-T5-Authorized-Entities',
      error: err.message,
      success: false,
    });
  }
};

export const getAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    const { cadTrustAefT5AuthorizedEntitiesId } = req.params;

    const aefT5AuthorizedEntities = await AefT5AuthorizedEntitiesV2.findByPk(cadTrustAefT5AuthorizedEntitiesId, {
      include: [
        {
          model: AefT1SubmissionV2,
          as: 'aefT1Submission',
          attributes: ['cadTrustAefT1SubmissionId', 'aefT1SubmissionParty', 'aefT1SubmissionVersion'],
        },
        {
          model: UnitV2,
          as: 'unit',
          attributes: ['cadTrustUnitId', 'unitSerialId', 'unitType', 'unitVintageYear'],
        },
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectSector', 'projectType'],
        },
      ],
    });

    if (!aefT5AuthorizedEntities) {
      return res.status(404).json({
        message: 'AEF-T5-Authorized-Entities not found',
        success: false,
      });
    }

    res.status(200).json(aefT5AuthorizedEntities);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching AEF-T5-Authorized-Entities:', err);
    res.status(400).json({
      message: 'Error retrieving AEF-T5-Authorized-Entities',
      error: err.message,
      success: false,
    });
  }
};

export const getAllAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    const aefT5AuthorizedEntities = await AefT5AuthorizedEntitiesV2.findAll({
      include: [
        {
          model: AefT1SubmissionV2,
          as: 'aefT1Submission',
          attributes: ['cadTrustAefT1SubmissionId', 'aefT1SubmissionParty', 'aefT1SubmissionVersion'],
        },
        {
          model: UnitV2,
          as: 'unit',
          attributes: ['cadTrustUnitId', 'unitSerialId', 'unitType', 'unitVintageYear'],
        },
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectSector', 'projectType'],
        },
      ],
      order: [['aefT5AuthorizedEntitiesAuthorizationDate', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: aefT5AuthorizedEntities,
      count: aefT5AuthorizedEntities.length,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error fetching AEF-T5-Authorized-Entities:', err);
    res.status(400).json({
      message: 'Error retrieving AEF-T5-Authorized-Entities',
      error: err.message,
      success: false,
    });
  }
};

export const updateAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustAefT5AuthorizedEntitiesId } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await AefT5AuthorizedEntitiesV2.findByPk(cadTrustAefT5AuthorizedEntitiesId);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'AEF-T5-Authorized-Entities not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = aefT5AuthorizedEntitiesV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating AEF-T5-Authorized-Entities',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating AEF-T5-Authorized-Entities',
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
          `cadTrustAefT1SubmissionId '${updateData.cadTrustAefT1SubmissionId}' does not exist. Please create the AEF-T1-Submission first or use a valid cadTrustAefT1SubmissionId.`
        );
      }
      if (updateData.cadTrustUnitId) {
        await assertRecordExistanceOrStaged(
          UnitV2,
          updateData.cadTrustUnitId,
          `cadTrustUnitId '${updateData.cadTrustUnitId}' does not exist. Please create the unit first or use a valid cadTrustUnitId.`
        );
      }
      if (updateData.cadTrustProjectId) {
        await assertRecordExistanceOrStaged(
          ProjectV2,
          updateData.cadTrustProjectId,
          `cadTrustProjectId '${updateData.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId.`
        );
      }
    } catch (err) {
      return res.status(400).json({
        message: 'Error updating AEF-T5-Authorized-Entities',
        error: err.message,
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_aef_t5_authorized_entities_id: cadTrustAefT5AuthorizedEntitiesId,
      ...convertToSnakeCase(_.omit(updateData, ['cadTrustAefT5AuthorizedEntitiesId', 'createdAt', 'updatedAt'])),
    };

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'aef_t5_authorized_entities',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T5-Authorized-Entities update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating AEF-T5-Authorized-Entities:', err);
    res.status(400).json({
      message: 'Error updating AEF-T5-Authorized-Entities',
      error: err.message,
      success: false,
    });
  }
};

export const deleteAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustAefT5AuthorizedEntitiesId } = req.params;

    // Verify record exists
    const existingRecord = await AefT5AuthorizedEntitiesV2.findByPk(cadTrustAefT5AuthorizedEntitiesId);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'AEF-T5-Authorized-Entities not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'aef_t5_authorized_entities',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_aef_t5_authorized_entities_id: cadTrustAefT5AuthorizedEntitiesId }]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T5-Authorized-Entities delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting AEF-T5-Authorized-Entities:', err);
    res.status(400).json({
      message: 'Error deleting AEF-T5-Authorized-Entities',
      error: err.message,
      success: false,
    });
  }
};
