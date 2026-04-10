'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, LabelV2, OrganizationsV2 } from '../../models/v2/index.js';
import { checkReferences, buildReferenceConflictBody } from '../../utils/v2-reference-guards.js';
import { labelV2Schema } from '../../validations/v2/label-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
  assertRecordExistanceOrStaged,
} from '../../utils/v2-data-assertions.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';
import { paginationParams, optionallyPaginatedResponse } from '../../utils/helpers.js';
import { loggerV2 } from '../../config/logger.js';

export const createLabelV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = labelV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new label',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new label',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustLabelId')) {
      return res.status(400).json({
        message: 'Error creating new label',
        error: 'cadTrustLabelId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustLabelId = uuidv4();

    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error creating new label',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_label_id: cadTrustLabelId,
      org_uid: homeOrg.org_uid,
      label_name: newRecord.labelName,
      label_type: newRecord.labelType,
      label_link: newRecord.labelLink,
      label_date: newRecord.labelDate,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'label',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Label staged successfully',
      uuid,
      cadTrustLabelId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating label:', err);
    res.status(400).json({
      message: 'Error creating new label',
      error: err.message,
      success: false,
    });
  }
};

export const getLabelV2 = async (req, res) => {
  try {
    const { id } = req.params;

    const label = await LabelV2.findByPk(id);

    if (!label) {
      return res.status(404).json({
        message: 'Label not found',
        success: false,
      });
    }

    res.status(200).json(label);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching label:', err);
    res.status(400).json({
      message: 'Error retrieving label',
      error: err.message,
      success: false,
    });
  }
};

export const getAllLabelsV2 = async (req, res) => {
  try {
    const { page, limit, orgUid } = req.query;
    const pagination = paginationParams(page, limit);
    const resolvedOrgUid = await resolveOrgUid(orgUid);

    const queryOptions = { distinct: true, order: [['createdAt', 'DESC']], ...pagination };
    if (resolvedOrgUid) {
      queryOptions.where = { orgUid: resolvedOrgUid };
    }

    const records = await LabelV2.findAndCountAll(queryOptions);

    res.json(optionallyPaginatedResponse(records, page, limit));
  } catch (err) {
    loggerV2.error('[v2]: Error fetching labels:', err);
    res.status(400).json({
      message: 'Error retrieving labels',
      error: err.message,
      success: false,
    });
  }
};

export const updateLabelV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation) - check both main table and staging
    try {
      await assertRecordExistanceOrStaged(
        LabelV2,
        id,
        `Label with ID '${id}' does not exist`
      );
    } catch (err) {
      return res.status(404).json({
        message: 'Label not found',
        error: err.message,
        success: false,
      });
    }

    // Validate the request data
    const { error } = labelV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating label',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating label',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error updating label',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_label_id: id, // Use UUID string directly
      org_uid: homeOrg.org_uid,
    };

    if (updateData.labelName !== undefined) dbUpdateData.label_name = updateData.labelName;
    if (updateData.labelType !== undefined) dbUpdateData.label_type = updateData.labelType;
    if (updateData.labelLink !== undefined) dbUpdateData.label_link = updateData.labelLink;
    if (updateData.labelDate !== undefined) dbUpdateData.label_date = updateData.labelDate;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'label',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Label update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating label:', err);
    res.status(400).json({
      message: 'Error updating label',
      error: err.message,
      success: false,
    });
  }
};

export const deleteLabelV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    const existingRecord = await LabelV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Label not found',
        success: false,
      });
    }

    const force = req.query.force === 'true';
    if (!force) {
      const refResult = await checkReferences('label', id);
      if (refResult.hasReferences) {
        return res.status(409).json(buildReferenceConflictBody('label', refResult));
      }
    }

    await StagingV2.create({
      uuid: uuidv4(),
      table: 'label',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_label_id: id }]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Label delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting label:', err);
    res.status(400).json({
      message: 'Error deleting label',
      error: err.message,
      success: false,
    });
  }
};
