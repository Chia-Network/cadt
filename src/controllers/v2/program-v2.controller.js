'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';

import { StagingV2, ProgramV2, OrganizationsV2 } from '../../models/v2/index.js';
import { checkReferences, buildReferenceConflictBody } from '../../utils/v2-reference-guards.js';

import {
  optionallyPaginatedResponse,
  paginationParams,
} from '../../utils/helpers';

import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
} from '../../utils/v2-data-assertions.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';

import { loggerV2 } from '../../config/logger.js';
import { programV2Schema } from '../../validations/v2/program-v2.validations.js';

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = programV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error creating new program',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new program',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustProgramId')) {
      return res.status(400).json({
        message: 'Error creating new program',
        error: 'cadTrustProgramId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustProgramId = uuidv4();

    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error creating new program',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_program_id: cadTrustProgramId,
      org_uid: homeOrg.org_uid,
      program_name: newRecord.programName,
      program_registry: newRecord.programRegistry,
      program_registry_activity_id: newRecord.programRegistryActivityId,
      program_registry_program_id: newRecord.programRegistryProgramId,
      program_description: newRecord.programDescription,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'program',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Program staged successfully',
      uuid,
      cadTrustProgramId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating program:', err);
    res.status(400).json({
      message: 'Error creating new program',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    const { page, limit, orgUid } = req.query;
    const pagination = paginationParams(page, limit);
    const resolvedOrgUid = await resolveOrgUid(orgUid);

    const queryOptions = { ...pagination };
    if (resolvedOrgUid) {
      queryOptions.where = { orgUid: resolvedOrgUid };
    }

    const records = await ProgramV2.findAndCountAll(queryOptions);

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving programs:', err);
    res.status(400).json({
      message: 'Error retrieving programs',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await ProgramV2.findByPk(id);

    if (!record) {
      return res.status(404).json({
        message: 'Program not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving program:', err);
    res.status(400).json({
      message: 'Error retrieving program',
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
    const existingRecord = await ProgramV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Program not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = programV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        message: 'Error updating program',
        error: error.details[0].message,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating program',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error updating program',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_program_id: id, // Use UUID string directly
      org_uid: homeOrg.org_uid,
    };

    if (updateData.programName !== undefined) dbUpdateData.program_name = updateData.programName;
    if (updateData.programRegistry !== undefined) dbUpdateData.program_registry = updateData.programRegistry;
    if (updateData.programRegistryActivityId !== undefined) dbUpdateData.program_registry_activity_id = updateData.programRegistryActivityId;
    if (updateData.programRegistryProgramId !== undefined) dbUpdateData.program_registry_program_id = updateData.programRegistryProgramId;
    if (updateData.programDescription !== undefined) dbUpdateData.program_description = updateData.programDescription;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'program',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Program update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating program:', err);
    res.status(400).json({
      message: 'Error updating program',
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

    const existingRecord = await ProgramV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Program not found',
        success: false,
      });
    }

    const force = req.query.force === 'true';
    if (!force) {
      const refResult = await checkReferences('program', id);
      if (refResult.hasReferences) {
        return res.status(409).json(buildReferenceConflictBody('program', refResult));
      }
    }

    await StagingV2.create({
      uuid: uuidv4(),
      table: 'program',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_program_id: id }]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Program delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting program:', err);
    res.status(400).json({
      message: 'Error deleting program',
      error: err.message,
      success: false,
    });
  }
};
