'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, ProjectV2, ProgramV2, OrganizationsV2 } from '../../models/v2/index.js';

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
import { projectV2Schema } from '../../validations/v2/project-v2.validations.js';

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = projectV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error creating new project',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new project',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustProjectId')) {
      return res.status(400).json({
        message: 'Error creating new project',
        error: 'cadTrustProjectId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign key if provided
    if (newRecord.cadTrustProgramId) {
      await assertRecordExistanceOrStaged(ProgramV2, newRecord.cadTrustProgramId);
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_project_id: uuidv4(), // Generate UUID for primary key
      project_registry_name: newRecord.projectRegistryName,
      project_id: newRecord.projectId,
      project_crediting_program: newRecord.projectCreditingProgram,
      project_name: newRecord.projectName,
      project_link: newRecord.projectLink,
      project_description: newRecord.projectDescription,
      project_sector: newRecord.projectSector,
      project_type: newRecord.projectType,
      project_subtype: newRecord.projectSubtype,
      project_status: newRecord.projectStatus,
      project_status_date: newRecord.projectStatusDate,
      project_unit_metric: newRecord.projectUnitMetric,
      cad_trust_reference_project_id: newRecord.cadTrustReferenceProjectId,
      cad_trust_program_id: newRecord.cadTrustProgramId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'project',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project staged successfully',
      uuid,
      success: true,
    });
  } catch (err) {
    logger.error('Error creating project:', err);
    res.status(400).json({
      message: 'Error creating new project',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pagination = paginationParams(page, limit);

    const records = await ProjectV2.findAndCountAll({
      ...pagination,
      include: [
        {
          model: ProgramV2,
          as: 'program',
          required: false,
        },
      ],
    });

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    logger.error('Error retrieving projects:', err);
    res.status(400).json({
      message: 'Error retrieving projects',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await ProjectV2.findByPk(id, {
      include: [
        {
          model: ProgramV2,
          as: 'program',
          required: false,
        },
      ],
    });

    if (!record) {
      return res.status(404).json({
        message: 'Project not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    logger.error('Error retrieving project:', err);
    res.status(400).json({
      message: 'Error retrieving project',
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
    const existingRecord = await ProjectV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Project not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = projectV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error updating project',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating project',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign key if provided
    if (updateData.cadTrustProgramId) {
      await assertRecordExistanceOrStaged(ProgramV2, updateData.cadTrustProgramId);
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_project_id: id, // Use UUID string directly
    };

    if (updateData.projectRegistryName !== undefined) dbUpdateData.project_registry_name = updateData.projectRegistryName;
    if (updateData.projectId !== undefined) dbUpdateData.project_id = updateData.projectId;
    if (updateData.projectCreditingProgram !== undefined) dbUpdateData.project_crediting_program = updateData.projectCreditingProgram;
    if (updateData.projectName !== undefined) dbUpdateData.project_name = updateData.projectName;
    if (updateData.projectLink !== undefined) dbUpdateData.project_link = updateData.projectLink;
    if (updateData.projectDescription !== undefined) dbUpdateData.project_description = updateData.projectDescription;
    if (updateData.projectSector !== undefined) dbUpdateData.project_sector = updateData.projectSector;
    if (updateData.projectType !== undefined) dbUpdateData.project_type = updateData.projectType;
    if (updateData.projectSubtype !== undefined) dbUpdateData.project_subtype = updateData.projectSubtype;
    if (updateData.projectStatus !== undefined) dbUpdateData.project_status = updateData.projectStatus;
    if (updateData.projectStatusDate !== undefined) dbUpdateData.project_status_date = updateData.projectStatusDate;
    if (updateData.projectUnitMetric !== undefined) dbUpdateData.project_unit_metric = updateData.projectUnitMetric;
    if (updateData.cadTrustReferenceProjectId !== undefined) dbUpdateData.cad_trust_reference_project_id = updateData.cadTrustReferenceProjectId;
    if (updateData.cadTrustProgramId !== undefined) dbUpdateData.cad_trust_program_id = updateData.cadTrustProgramId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'project',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project update staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('Error updating project:', err);
    res.status(400).json({
      message: 'Error updating project',
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
    const existingRecord = await ProjectV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Project not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'project',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_project_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Project delete staged successfully',
      success: true,
    });
  } catch (err) {
    logger.error('Error deleting project:', err);
    res.status(400).json({
      message: 'Error deleting project',
      error: err.message,
      success: false,
    });
  }
};
