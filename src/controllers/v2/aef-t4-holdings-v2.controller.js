'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, AefT4HoldingsV2, AefT1SubmissionV2, UnitV2, ProjectV2, AefT2AuthorizationsV2 } from '../../models/v2/index.js';
import { aefT4HoldingsV2Schema } from '../../validations/v2/aef-t4-holdings-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { convertToSnakeCase } from '../../utils/v2-camel-to-snake.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';
import { paginationParams, optionallyPaginatedResponse } from '../../utils/helpers.js';
import { loggerV2 } from '../../config/logger.js';

export const createAefT4HoldingsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    const homeOrg = await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = aefT4HoldingsV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new AEF-T4-Holdings',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new AEF-T4-Holdings',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustAefT4HoldingsId')) {
      return res.status(400).json({
        message: 'Error creating new AEF-T4-Holdings',
        error: 'cadTrustAefT4HoldingsId is auto-generated and cannot be set via API',
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
        message: 'Error creating new AEF-T4-Holdings',
        error: err.message,
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustAefT4HoldingsId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_aef_t4_holdings_id: cadTrustAefT4HoldingsId,
      ...convertToSnakeCase(_.omit(newRecord, ['cadTrustAefT4HoldingsId', 'createdAt', 'updatedAt'])),
      created_by_org_uid: homeOrg.org_uid,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'aef_t4_holdings',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T4-Holdings staged successfully',
      uuid,
      cadTrustAefT4HoldingsId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating AEF-T4-Holdings:', err);
    res.status(400).json({
      message: 'Error creating new AEF-T4-Holdings',
      error: err.message,
      success: false,
    });
  }
};

export const getAefT4HoldingsV2 = async (req, res) => {
  try {
    const { cadTrustAefT4HoldingsId } = req.params;

    const aefT4Holdings = await AefT4HoldingsV2.findByPk(cadTrustAefT4HoldingsId);

    if (!aefT4Holdings) {
      return res.status(404).json({
        message: 'AEF-T4-Holdings not found',
        success: false,
      });
    }

    res.status(200).json(aefT4Holdings);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching AEF-T4-Holdings:', err);
    res.status(400).json({
      message: 'Error retrieving AEF-T4-Holdings',
      error: err.message,
      success: false,
    });
  }
};

export const getAllAefT4HoldingsV2 = async (req, res) => {
  try {
    const { page, limit, orgUid, createdByOrgUid } = req.query;
    const pagination = paginationParams(page, limit);
    const resolvedOrgUid = await resolveOrgUid(orgUid);
    const resolvedCreatedByOrgUid = await resolveOrgUid(createdByOrgUid);

    const queryOptions = { distinct: true, order: [['aefT4HoldingsVintageYear', 'DESC']], ...pagination };
    if (resolvedOrgUid) {
      queryOptions.include = [{
        model: ProjectV2,
        as: 'project',
        attributes: [],
        where: { orgUid: resolvedOrgUid },
        required: true,
      }];
    }
    if (resolvedCreatedByOrgUid) {
      queryOptions.where = { ...queryOptions.where, createdByOrgUid: resolvedCreatedByOrgUid };
    }

    const records = await AefT4HoldingsV2.findAndCountAll(queryOptions);

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error fetching AEF-T4-Holdings:', err);
    res.status(400).json({
      message: 'Error retrieving AEF-T4-Holdings',
      error: err.message,
      success: false,
    });
  }
};

export const updateAefT4HoldingsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    const homeOrg = await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustAefT4HoldingsId } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation) - check both main table and staging
    try {
      await assertRecordExistanceOrStaged(
        AefT4HoldingsV2,
        cadTrustAefT4HoldingsId,
        `AEF-T4-Holdings with ID '${cadTrustAefT4HoldingsId}' does not exist`
      );
    } catch (err) {
      return res.status(404).json({
        message: 'AEF-T4-Holdings not found',
        error: err.message,
        success: false,
      });
    }

    // Validate the request data
    const { error } = aefT4HoldingsV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating AEF-T4-Holdings',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating AEF-T4-Holdings',
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
        message: 'Error updating AEF-T4-Holdings',
        error: err.message,
        success: false,
      });
    }

    const existingRecord = await AefT4HoldingsV2.findByPk(cadTrustAefT4HoldingsId);

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_aef_t4_holdings_id: cadTrustAefT4HoldingsId,
      ...convertToSnakeCase(_.omit(updateData, ['cadTrustAefT4HoldingsId', 'createdAt', 'updatedAt'])),
      created_by_org_uid: existingRecord?.createdByOrgUid || homeOrg.org_uid,
    };

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'aef_t4_holdings',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T4-Holdings update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating AEF-T4-Holdings:', err);
    res.status(400).json({
      message: 'Error updating AEF-T4-Holdings',
      error: err.message,
      success: false,
    });
  }
};

export const deleteAefT4HoldingsV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { cadTrustAefT4HoldingsId } = req.params;

    // Verify record exists - check both main table and staging
    try {
      await assertRecordExistanceOrStaged(
        AefT4HoldingsV2,
        cadTrustAefT4HoldingsId,
        `AEF-T4-Holdings with ID '${cadTrustAefT4HoldingsId}' does not exist`
      );
    } catch (err) {
      return res.status(404).json({
        message: 'AEF-T4-Holdings not found',
        error: err.message,
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'aef_t4_holdings',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_aef_t4_holdings_id: cadTrustAefT4HoldingsId }]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'AEF-T4-Holdings delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting AEF-T4-Holdings:', err);
    res.status(400).json({
      message: 'Error deleting AEF-T4-Holdings',
      error: err.message,
      success: false,
    });
  }
};
