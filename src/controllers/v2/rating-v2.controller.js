'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, RatingV2, ProjectV2 } from '../../models/v2/index.js';
import { ratingV2Schema } from '../../validations/v2/rating-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';
import { paginationParams, optionallyPaginatedResponse } from '../../utils/helpers.js';
import { loggerV2 } from '../../config/logger.js';

export const createRatingV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = ratingV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new rating',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new rating',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustRatingId')) {
      return res.status(400).json({
        message: 'Error creating new rating',
        error: 'cadTrustRatingId is auto-generated and cannot be set via API',
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
          message: 'Error creating new rating',
          error: err.message,
          success: false,
        });
      }
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustRatingId = uuidv4();

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_rating_id: cadTrustRatingId,
      rating_type: newRecord.ratingType,
      rating_name: newRecord.ratingName,
      rating_value: newRecord.ratingValue,
      rating_link: newRecord.ratingLink,
      cad_trust_project_id: newRecord.cadTrustProjectId,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'rating',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Rating staged successfully',
      uuid,
      cadTrustRatingId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating rating:', err);
    res.status(400).json({
      message: 'Error creating new rating',
      error: err.message,
      success: false,
    });
  }
};

export const getRatingV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rating ID format',
      });
    }

    const rating = await RatingV2.findByPk(id);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found',
      });
    }

    res.json(rating);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching rating:', err);
    res.status(400).json({
      message: 'Error retrieving rating',
      error: err.message,
      success: false,
    });
  }
};

export const getAllRatingsV2 = async (req, res) => {
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

    const records = await RatingV2.findAndCountAll(queryOptions);

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error fetching ratings:', err);
    res.status(400).json({
      message: 'Error retrieving ratings',
      error: err.message,
      success: false,
    });
  }
};

export const updateRatingV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await RatingV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Rating not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = ratingV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating rating',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating rating',
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
          message: 'Error updating rating',
          error: err.message,
          success: false,
        });
      }
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_rating_id: id, // Use UUID string directly
    };

    if (updateData.ratingType !== undefined) dbUpdateData.rating_type = updateData.ratingType;
    if (updateData.ratingName !== undefined) dbUpdateData.rating_name = updateData.ratingName;
    if (updateData.ratingValue !== undefined) dbUpdateData.rating_value = updateData.ratingValue;
    if (updateData.ratingLink !== undefined) dbUpdateData.rating_link = updateData.ratingLink;
    if (updateData.cadTrustProjectId !== undefined) dbUpdateData.cad_trust_project_id = updateData.cadTrustProjectId;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'rating',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Rating update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating rating:', err);
    res.status(400).json({
      message: 'Error updating rating',
      error: err.message,
      success: false,
    });
  }
};

export const deleteRatingV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    // Verify record exists
    const existingRecord = await RatingV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Rating not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'rating',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_rating_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Rating delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting rating:', err);
    res.status(400).json({
      message: 'Error deleting rating',
      error: err.message,
      success: false,
    });
  }
};
