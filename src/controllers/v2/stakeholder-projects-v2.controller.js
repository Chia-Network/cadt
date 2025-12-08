'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, StakeholderProjectV2, StakeholderV2, ProjectV2 } from '../../models/v2/index.js';
import { stakeholderProjectV2Schema } from '../../validations/v2/stakeholder-projects-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { loggerV2 } from '../../config/logger.js';

export const createStakeholderProjectV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = stakeholderProjectV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new stakeholder-project relationship',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new stakeholder-project relationship',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustStakeholderProjectId')) {
      return res.status(400).json({
        message: 'Error creating new stakeholder-project relationship',
        error: 'cadTrustStakeholderProjectId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys: Both Stakeholder and Project must exist
    try {
      await assertRecordExistanceOrStaged(
        StakeholderV2,
        newRecord.cadTrustStakeholderId,
        `cadTrustStakeholderId '${newRecord.cadTrustStakeholderId}' does not exist. Please create the stakeholder first or use a valid cadTrustStakeholderId`
      );
      await assertRecordExistanceOrStaged(
        ProjectV2,
        newRecord.cadTrustProjectId,
        `cadTrustProjectId '${newRecord.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId`
      );
    } catch (err) {
      return res.status(400).json({
        message: 'Error creating new stakeholder-project relationship',
        error: err.message,
        success: false,
      });
    }

    // Check if the relationship already exists (in main table or staging)
    const existingRelation = await StakeholderProjectV2.findOne({
      where: {
        cadTrustStakeholderId: newRecord.cadTrustStakeholderId,
        cadTrustProjectId: newRecord.cadTrustProjectId,
      },
    });

    if (existingRelation) {
      return res.status(409).json({
        message: 'Error creating new stakeholder-project relationship',
        error: 'Stakeholder-Project relationship already exists',
        success: false,
      });
    }

    // Check staging table for pending inserts
    const stagingRecords = await StagingV2.findAll({
      where: {
        table: 'stakeholder_projects',
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
            record.cad_trust_stakeholder_id === newRecord.cadTrustStakeholderId &&
            record.cad_trust_project_id === newRecord.cadTrustProjectId
          ) {
            return res.status(409).json({
              message: 'Error creating new stakeholder-project relationship',
              error: 'Stakeholder-Project relationship already exists in staging',
              success: false,
            });
          }
        }
      } catch (parseError) {
        continue;
      }
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustStakeholderProjectId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_stakeholder_project_id: cadTrustStakeholderProjectId,
      cad_trust_stakeholder_id: newRecord.cadTrustStakeholderId,
      cad_trust_project_id: newRecord.cadTrustProjectId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'stakeholder_projects',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Stakeholder-Project relationship staged successfully',
      uuid,
      cadTrustStakeholderProjectId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating stakeholder-project relationship:', err);
    res.status(400).json({
      message: 'Error creating new stakeholder-project relationship',
      error: err.message,
      success: false,
    });
  }
};

export const getStakeholderProjectV2 = async (req, res) => {
  try {
    const { id } = req.params;

    const stakeholderProject = await StakeholderProjectV2.findByPk(id, {
      include: [
        {
          model: StakeholderV2,
          as: 'stakeholder',
          attributes: ['cadTrustStakeholderId', 'stakeholderName', 'stakeholderType'],
        },
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
        },
      ],
    });

    if (!stakeholderProject) {
      return res.status(404).json({
        message: 'Stakeholder-Project relationship not found',
        success: false,
      });
    }

    res.status(200).json(stakeholderProject);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching stakeholder-project relationship:', err);
    res.status(400).json({
      message: 'Error retrieving stakeholder-project relationship',
      error: err.message,
      success: false,
    });
  }
};

export const getAllStakeholderProjectsV2 = async (req, res) => {
  try {
    const stakeholderProjects = await StakeholderProjectV2.findAll({
      include: [
        {
          model: StakeholderV2,
          as: 'stakeholder',
          attributes: ['cadTrustStakeholderId', 'stakeholderName', 'stakeholderType'],
        },
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: stakeholderProjects,
      count: stakeholderProjects.length,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error fetching stakeholder-project relationships:', err);
    res.status(400).json({
      message: 'Error retrieving stakeholder-project relationships',
      error: err.message,
      success: false,
    });
  }
};

export const updateStakeholderProjectV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await StakeholderProjectV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Stakeholder-Project relationship not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = stakeholderProjectV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating stakeholder-project relationship',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating stakeholder-project relationship',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys if they're being changed
    if (updateData.cadTrustStakeholderId !== existingRecord.cadTrustStakeholderId || updateData.cadTrustProjectId !== existingRecord.cadTrustProjectId) {
      try {
        if (updateData.cadTrustStakeholderId) {
          await assertRecordExistanceOrStaged(
            StakeholderV2,
            updateData.cadTrustStakeholderId,
            `cadTrustStakeholderId '${updateData.cadTrustStakeholderId}' does not exist. Please create the stakeholder first or use a valid cadTrustStakeholderId`
          );
        }
        if (updateData.cadTrustProjectId) {
          await assertRecordExistanceOrStaged(
            ProjectV2,
            updateData.cadTrustProjectId,
            `cadTrustProjectId '${updateData.cadTrustProjectId}' does not exist. Please create the project first or use a valid cadTrustProjectId`
          );
        }
      } catch (err) {
        return res.status(400).json({
          message: 'Error updating stakeholder-project relationship',
          error: err.message,
          success: false,
        });
      }
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_stakeholder_project_id: id, // Use UUID string directly
    };

    if (updateData.cadTrustStakeholderId !== undefined) dbUpdateData.cad_trust_stakeholder_id = updateData.cadTrustStakeholderId;
    if (updateData.cadTrustProjectId !== undefined) dbUpdateData.cad_trust_project_id = updateData.cadTrustProjectId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'stakeholder_projects',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Stakeholder-Project relationship update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating stakeholder-project relationship:', err);
    res.status(400).json({
      message: 'Error updating stakeholder-project relationship',
      error: err.message,
      success: false,
    });
  }
};

export const deleteStakeholderProjectV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    // Verify record exists
    const existingRecord = await StakeholderProjectV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Stakeholder-Project relationship not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'stakeholder_projects',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_stakeholder_project_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Stakeholder-Project relationship delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting stakeholder-project relationship:', err);
    res.status(400).json({
      message: 'Error deleting stakeholder-project relationship',
      error: err.message,
      success: false,
    });
  }
};
