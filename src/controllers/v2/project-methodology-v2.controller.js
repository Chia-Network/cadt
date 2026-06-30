'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, ProjectMethodologyV2, ProjectV2, MethodologyV2 } from '../../models/v2/index.js';
import { projectMethodologyV2Schema } from '../../validations/v2/project-methodology-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';
import { paginationParams, optionallyPaginatedResponse } from '../../utils/helpers.js';
import { loggerV2 } from '../../config/logger.js';
import { checkReferences, buildReferenceConflictBody } from '../../utils/v2-reference-guards.js';

export const createProjectMethodologyV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Check for forbidden fields BEFORE Joi validation
    // This ensures we return custom error messages instead of Joi's "not allowed" message
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new project-methodology relationship',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustProjectMethodologyId')) {
      return res.status(400).json({
        message: 'Error creating new project-methodology relationship',
        error: 'cadTrustProjectMethodologyId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate the request data
    const { error } = projectMethodologyV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new project-methodology relationship',
        error: errorMessage,
        success: false,
      });
    }

    // Validate foreign keys: Both Project and Methodology must exist
    try {
      await assertRecordExistanceOrStaged(
        ProjectV2,
        newRecord.cadTrustProjectId,
        `cadTrustProjectId '${newRecord.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId`
      );
      await assertRecordExistanceOrStaged(
        MethodologyV2,
        newRecord.cadTrustMethodologyId,
        `cadTrustMethodologyId '${newRecord.cadTrustMethodologyId}' does not exist. Please create the methodology first or use a valid cadTrustMethodologyId`
      );
    } catch (err) {
      return res.status(400).json({
        message: 'Error creating new project-methodology relationship',
        error: err.message,
        success: false,
      });
    }

    // Check if the relationship already exists (in main table or staging)
    // Wrap in try-catch to handle cases where table/column might not exist yet
    let existingRelation = null;
    try {
      existingRelation = await ProjectMethodologyV2.findOne({
        where: {
          cadTrustProjectId: newRecord.cadTrustProjectId,
          cadTrustMethodologyId: newRecord.cadTrustMethodologyId,
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
        message: 'Error creating new project-methodology relationship',
        error: 'Project-Methodology relationship already exists',
        success: false,
      });
    }

    // Check staging table for pending inserts
    const stagingRecords = await StagingV2.findAll({
      where: {
        table: 'project_methodology',
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
            record.cad_trust_project_id === newRecord.cadTrustProjectId &&
            record.cad_trust_methodology_id === newRecord.cadTrustMethodologyId
          ) {
            return res.status(409).json({
              message: 'Error creating new project-methodology relationship',
              error: 'Project-Methodology relationship already exists in staging',
              success: false,
            });
          }
        }
      } catch (parseError) {
        continue;
      }
    }

    // Generate UUID for the primary key
    const cadTrustProjectMethodologyId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_project_methodology_id: cadTrustProjectMethodologyId,
      cad_trust_project_id: newRecord.cadTrustProjectId,
      cad_trust_methodology_id: newRecord.cadTrustMethodologyId,
      project_methodology_date: newRecord.projectMethodologyDate,
      project_methodology_description: newRecord.projectMethodologyDescription,
    };

    // Stage the record
    await StagingV2.create({
      uuid: cadTrustProjectMethodologyId,
      table: 'project_methodology',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project-Methodology relationship staged successfully',
      uuid: cadTrustProjectMethodologyId,
      cadTrustProjectMethodologyId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating project-methodology relationship:', err);
    res.status(400).json({
      message: 'Error creating new project-methodology relationship',
      error: err.message,
      success: false,
    });
  }
};

export const getProjectMethodologyV2 = async (req, res) => {
  try {
    const { cadTrustProjectMethodologyId } = req.params;

    const projectMethodology = await ProjectMethodologyV2.findOne({
      where: {
        cadTrustProjectMethodologyId,
      },
    });

    if (!projectMethodology) {
      return res.status(404).json({
        message: 'Project-Methodology relationship not found',
        success: false,
      });
    }

    res.status(200).json(projectMethodology);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching project-methodology relationship:', err);
    res.status(400).json({
      message: 'Error retrieving project-methodology relationship',
      error: err.message,
      success: false,
    });
  }
};

export const getAllProjectMethodologiesV2 = async (req, res) => {
  try {
    const { page, limit, orgUid } = req.query;
    const pagination = paginationParams(page, limit);
    const resolvedOrgUid = await resolveOrgUid(orgUid);

    const queryOptions = { distinct: true, order: [['createdAt', 'DESC']], ...pagination };
    if (resolvedOrgUid) {
      queryOptions.include = [{
        model: ProjectV2,
        as: 'project',
        attributes: [],
        where: { orgUid: resolvedOrgUid },
        required: true,
      }];
    }

    const records = await ProjectMethodologyV2.findAndCountAll(queryOptions);

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error fetching project-methodology relationships:', err);
    res.status(400).json({
      message: 'Error retrieving project-methodology relationships',
      error: err.message,
      success: false,
    });
  }
};

export const updateProjectMethodologyV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustProjectMethodologyId } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await ProjectMethodologyV2.findOne({
      where: {
        cadTrustProjectMethodologyId,
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        message: 'Project-Methodology relationship not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = projectMethodologyV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating project-methodology relationship',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating project-methodology relationship',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys if they're being changed
    if (updateData.cadTrustProjectId !== existingRecord.cadTrustProjectId || updateData.cadTrustMethodologyId !== existingRecord.cadTrustMethodologyId) {
      try {
        if (updateData.cadTrustProjectId) {
          await assertRecordExistanceOrStaged(
            ProjectV2,
            updateData.cadTrustProjectId,
            `cadTrustProjectId '${updateData.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId`
          );
        }
        if (updateData.cadTrustMethodologyId) {
          await assertRecordExistanceOrStaged(
            MethodologyV2,
            updateData.cadTrustMethodologyId,
            `cadTrustMethodologyId '${updateData.cadTrustMethodologyId}' does not exist. Please create the methodology first or use a valid cadTrustMethodologyId`
          );
        }
      } catch (err) {
        return res.status(400).json({
          message: 'Error updating project-methodology relationship',
          error: err.message,
          success: false,
        });
      }
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_project_methodology_id: cadTrustProjectMethodologyId,
    };

    if (updateData.cadTrustProjectId !== undefined) dbUpdateData.cad_trust_project_id = updateData.cadTrustProjectId;
    if (updateData.cadTrustMethodologyId !== undefined) dbUpdateData.cad_trust_methodology_id = updateData.cadTrustMethodologyId;
    if (updateData.projectMethodologyDate !== undefined) dbUpdateData.project_methodology_date = updateData.projectMethodologyDate;
    if (updateData.projectMethodologyDescription !== undefined) dbUpdateData.project_methodology_description = updateData.projectMethodologyDescription;

    // Stage the update
    await StagingV2.create({
      uuid: cadTrustProjectMethodologyId,
      table: 'project_methodology',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project-Methodology relationship update staged successfully',
      cadTrustProjectMethodologyId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating project-methodology relationship:', err);
    res.status(400).json({
      message: 'Error updating project-methodology relationship',
      error: err.message,
      success: false,
    });
  }
};

export const deleteProjectMethodologyV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustProjectMethodologyId } = req.params;

    // Verify record exists
    const existingRecord = await ProjectMethodologyV2.findOne({
      where: {
        cadTrustProjectMethodologyId,
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        message: 'Project-Methodology relationship not found',
        success: false,
      });
    }

    const refResult = await checkReferences('project_methodology', cadTrustProjectMethodologyId);
    if (refResult.hasReferences) {
      return res.status(409).json(
        buildReferenceConflictBody('project-methodology relationship', refResult),
      );
    }

    // Stage the delete
    await StagingV2.create({
      uuid: cadTrustProjectMethodologyId,
      table: 'project_methodology',
      action: 'DELETE',
      data: JSON.stringify([{
        cad_trust_project_methodology_id: cadTrustProjectMethodologyId,
      }]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project-Methodology relationship delete staged successfully',
      cadTrustProjectMethodologyId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting project-methodology relationship:', err);
    res.status(400).json({
      message: 'Error deleting project-methodology relationship',
      error: err.message,
      success: false,
    });
  }
};
