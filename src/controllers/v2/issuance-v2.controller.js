'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from 'sequelize';
import { sequelizeV2 } from '../../database/v2/index.js';
import { processingSyncRegistriesTransactionMutexV2 } from '../../utils/v2-mutex-utils.js';

import { StagingV2, IssuanceV2, VerificationV2, ProjectMethodologyV2, ProjectV2, LocationV2 } from '../../models/v2/index.js';

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
import { resolveOrgUid } from '../../utils/owner-utils.js';

import { loggerV2 } from '../../config/logger.js';
import { issuanceV2Schema } from '../../validations/v2/issuance-v2.validations.js';
import { stageIssuanceChildDeletes } from '../../utils/v2-cascade-delete.js';

export const create = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    const homeOrg = await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = issuanceV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustIssuanceId')) {
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: 'cadTrustIssuanceId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustIssuanceId')) {
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: 'cadTrustIssuanceId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Validate foreign keys
    try {
      await assertRecordExistanceOrStaged(
        VerificationV2,
        newRecord.cadTrustVerificationId,
        `cadTrustVerificationId '${newRecord.cadTrustVerificationId}' does not exist. Please create the verification first or use a valid cadTrustVerificationId`,
      );
      await assertRecordExistanceOrStaged(
        ProjectMethodologyV2,
        newRecord.cadTrustProjectMethodologyId,
        `cadTrustProjectMethodologyId '${newRecord.cadTrustProjectMethodologyId}' does not exist. Please create the project methodology first or use a valid cadTrustProjectMethodologyId`,
      );
    } catch (err) {
      return res.status(400).json({
        message: 'Error creating new issuance',
        error: err.message,
        success: false,
      });
    }

    if (newRecord.cadTrustLocationId) {
      // Note: LocationV2 validation will be added when Location endpoint is implemented
      // await assertRecordExistanceOrStaged(LocationV2, newRecord.cadTrustLocationId);
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustIssuanceId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_issuance_id: cadTrustIssuanceId,
      issuance_id: newRecord.issuanceId,
      issuance_date: newRecord.issuanceDate,
      cad_trust_verification_id: newRecord.cadTrustVerificationId,
      cad_trust_project_methodology_id: newRecord.cadTrustProjectMethodologyId,
      cad_trust_location_id: newRecord.cadTrustLocationId,
      created_by_org_uid: homeOrg.org_uid,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'issuance',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Issuance staged successfully',
      uuid,
      cadTrustIssuanceId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating issuance:', err);
    res.status(400).json({
      message: 'Error creating new issuance',
      error: err.message,
      success: false,
    });
  }
};

export const findAll = async (req, res) => {
  try {
    const { page, limit, orgUid, createdByOrgUid } = req.query;
    const pagination = paginationParams(page, limit);
    const resolvedOrgUid = await resolveOrgUid(orgUid);
    const resolvedCreatedByOrgUid = await resolveOrgUid(createdByOrgUid);

    const queryOptions = {
      ...pagination,
    };
    if (resolvedOrgUid) {
      queryOptions.include = [{
        model: VerificationV2,
        as: 'verification',
        attributes: [],
        include: [{
          model: ProjectV2,
          as: 'project',
          attributes: [],
          where: { orgUid: resolvedOrgUid },
          required: true,
        }],
        required: true,
      }];
    }
    if (resolvedCreatedByOrgUid) {
      queryOptions.where = { ...queryOptions.where, createdByOrgUid: resolvedCreatedByOrgUid };
    }

    const records = await IssuanceV2.findAndCountAll(queryOptions);

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving issuances:', err);
    res.status(400).json({
      message: 'Error retrieving issuances',
      error: err.message,
      success: false,
    });
  }
};

export const findOne = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await IssuanceV2.findByPk(id);

    if (!record) {
      return res.status(404).json({
        message: 'Issuance not found',
        success: false,
      });
    }

    res.json(record);
  } catch (err) {
    loggerV2.error('[v2]: Error retrieving issuance:', err);
    res.status(400).json({
      message: 'Error retrieving issuance',
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
    const existingRecord = await IssuanceV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Issuance not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = issuanceV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating issuance',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating issuance',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    // Validate foreign keys
    try {
      await assertRecordExistanceOrStaged(
        VerificationV2,
        updateData.cadTrustVerificationId,
        `cadTrustVerificationId '${updateData.cadTrustVerificationId}' does not exist. Please create the verification first or use a valid cadTrustVerificationId`,
      );
      await assertRecordExistanceOrStaged(
        ProjectMethodologyV2,
        updateData.cadTrustProjectMethodologyId,
        `cadTrustProjectMethodologyId '${updateData.cadTrustProjectMethodologyId}' does not exist. Please create the project methodology first or use a valid cadTrustProjectMethodologyId`,
      );
    } catch (err) {
      return res.status(400).json({
        message: 'Error updating issuance',
        error: err.message,
        success: false,
      });
    }

    if (updateData.cadTrustLocationId) {
      // Note: LocationV2 validation will be added when Location endpoint is implemented
      // await assertRecordExistanceOrStaged(LocationV2, updateData.cadTrustLocationId);
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_issuance_id: id, // Use UUID string directly
    };

    if (updateData.issuanceId !== undefined) dbUpdateData.issuance_id = updateData.issuanceId;
    if (updateData.issuanceDate !== undefined) dbUpdateData.issuance_date = updateData.issuanceDate;
    if (updateData.cadTrustVerificationId !== undefined) dbUpdateData.cad_trust_verification_id = updateData.cadTrustVerificationId;
    if (updateData.cadTrustProjectMethodologyId !== undefined) dbUpdateData.cad_trust_project_methodology_id = updateData.cadTrustProjectMethodologyId;
    if (updateData.cadTrustLocationId !== undefined) dbUpdateData.cad_trust_location_id = updateData.cadTrustLocationId;
    if (existingRecord?.createdByOrgUid) {
      dbUpdateData.created_by_org_uid = existingRecord.createdByOrgUid;
    }

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'issuance',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Issuance update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating issuance:', err);
    res.status(400).json({
      message: 'Error updating issuance',
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
    const existingRecord = await IssuanceV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Issuance not found',
        success: false,
      });
    }

    const releaseTransactionMutex =
      await processingSyncRegistriesTransactionMutexV2.acquire();
    let stagedChildDeletes;
    try {
      stagedChildDeletes = await sequelizeV2.transaction(async (transaction) => {
        const childDeleteCount = await stageIssuanceChildDeletes(id, { transaction });

        await StagingV2.create({
          uuid: uuidv4(),
          table: 'issuance',
          action: 'DELETE',
          data: JSON.stringify([{ cad_trust_issuance_id: id }]),
          committed: false,
          failed_commit: false,
          is_transfer: false,
        }, { transaction });

        return childDeleteCount;
      });
    } finally {
      releaseTransactionMutex();
    }

    res.json({
      message: 'Issuance delete staged successfully',
      stagedChildDeletes,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting issuance:', err);
    res.status(400).json({
      message: 'Error deleting issuance',
      error: err.message,
      success: false,
    });
  }
};
