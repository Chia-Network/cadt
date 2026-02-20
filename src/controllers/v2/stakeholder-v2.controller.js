'use strict';

import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { StagingV2, StakeholderV2, OrganizationsV2 } from '../../models/v2/index.js';
import { stakeholderV2Schema } from '../../validations/v2/stakeholder-v2.validations.js';
import {
  assertV2IfReadOnlyMode,
  assertV2HomeOrgExists,
  assertNoPendingCommitsExcludingTransfers,
} from '../../utils/v2-data-assertions.js';
import { resolveOrgUid } from '../../utils/owner-utils.js';
import { loggerV2 } from '../../config/logger.js';

export const createStakeholderV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const newRecord = _.cloneDeep(req.body);

    // Validate the request data
    const { error } = stakeholderV2Schema.validate(newRecord, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error creating new stakeholder',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (newRecord.hasOwnProperty('createdAt') || newRecord.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error creating new stakeholder',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be set via API',
        success: false,
      });
    }

    // Check for forbidden ID field
    if (newRecord.hasOwnProperty('cadTrustStakeholderId')) {
      return res.status(400).json({
        message: 'Error creating new stakeholder',
        error: 'cadTrustStakeholderId is auto-generated and cannot be set via API',
        success: false,
      });
    }

    // Generate UUID for staging
    const uuid = uuidv4();

    // Generate UUID for primary key
    const cadTrustStakeholderId = uuidv4();

    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error creating new stakeholder',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbRecord = {
      cad_trust_stakeholder_id: cadTrustStakeholderId,
      org_uid: homeOrg.org_uid,
      stakeholder_name: newRecord.stakeholderName,
      stakeholder_type: newRecord.stakeholderType,
      stakeholder_link: newRecord.stakeholderLink,
    };

    // Stage the record
    await StagingV2.create({
      uuid,
      table: 'stakeholder',
      action: 'INSERT',
      data: JSON.stringify([dbRecord]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Stakeholder staged successfully',
      uuid,
      cadTrustStakeholderId,
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error creating stakeholder:', err);
    res.status(400).json({
      message: 'Error creating new stakeholder',
      error: err.message,
      success: false,
    });
  }
};

export const getStakeholderV2 = async (req, res) => {
  try {
    const { id } = req.params;

    const stakeholder = await StakeholderV2.findByPk(id);

    if (!stakeholder) {
      return res.status(404).json({
        message: 'Stakeholder not found',
        success: false,
      });
    }

    res.status(200).json(stakeholder);
  } catch (err) {
    loggerV2.error('[v2]: Error fetching stakeholder:', err);
    res.status(400).json({
      message: 'Error retrieving stakeholder',
      error: err.message,
      success: false,
    });
  }
};

export const getAllStakeholdersV2 = async (req, res) => {
  try {
    const { orgUid } = req.query;
    const resolvedOrgUid = await resolveOrgUid(orgUid);

    const queryOptions = { order: [['createdAt', 'DESC']] };
    if (resolvedOrgUid) {
      queryOptions.where = { orgUid: resolvedOrgUid };
    }

    const stakeholders = await StakeholderV2.findAll(queryOptions);

    res.status(200).json({
      success: true,
      data: stakeholders,
      count: stakeholders.length,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error fetching stakeholders:', err);
    res.status(400).json({
      message: 'Error retrieving stakeholders',
      error: err.message,
      success: false,
    });
  }
};

export const updateStakeholderV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;
    const updateData = _.cloneDeep(req.body);

    // Verify record exists first (before validation)
    const existingRecord = await StakeholderV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Stakeholder not found',
        success: false,
      });
    }

    // Validate the request data
    const { error } = stakeholderV2Schema.validate(updateData, {
      allowUnknown: false,
      stripUnknown: false,
    });

    if (error) {
      loggerV2.debug('[v2]: Validation error details:', { error, details: error.details });
      const errorMessage = error.details && error.details.length > 0
        ? error.details[0].message
        : error.message || 'Validation error';
      return res.status(400).json({
        message: 'Error updating stakeholder',
        error: errorMessage,
        success: false,
      });
    }

    // Check for forbidden fields
    if (updateData.hasOwnProperty('createdAt') || updateData.hasOwnProperty('updatedAt')) {
      return res.status(400).json({
        message: 'Error updating stakeholder',
        error: 'createdAt and updatedAt fields are automatically managed and cannot be updated via API',
        success: false,
      });
    }

    const homeOrg = await OrganizationsV2.getHomeOrg(false);
    if (!homeOrg) {
      return res.status(400).json({
        message: 'Error updating stakeholder',
        error: 'Home organization not found',
        success: false,
      });
    }

    // Convert camelCase API fields to snake_case DB fields for staging
    const dbUpdateData = {
      cad_trust_stakeholder_id: id, // Use UUID string directly
      org_uid: homeOrg.org_uid,
    };

    if (updateData.stakeholderName !== undefined) dbUpdateData.stakeholder_name = updateData.stakeholderName;
    if (updateData.stakeholderType !== undefined) dbUpdateData.stakeholder_type = updateData.stakeholderType;
    if (updateData.stakeholderLink !== undefined) dbUpdateData.stakeholder_link = updateData.stakeholderLink;

    // Stage the update
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'stakeholder',
      action: 'UPDATE',
      data: JSON.stringify([dbUpdateData]),
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Stakeholder update staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error updating stakeholder:', err);
    res.status(400).json({
      message: 'Error updating stakeholder',
      error: err.message,
      success: false,
    });
  }
};

export const deleteStakeholderV2 = async (req, res) => {
  try {
    await assertV2IfReadOnlyMode();
    await assertV2HomeOrgExists();
    await assertNoPendingCommitsExcludingTransfers();

    const { id } = req.params;

    // Verify record exists
    const existingRecord = await StakeholderV2.findByPk(id);
    if (!existingRecord) {
      return res.status(404).json({
        message: 'Stakeholder not found',
        success: false,
      });
    }

    // Stage the delete
    await StagingV2.create({
      uuid: uuidv4(),
      table: 'stakeholder',
      action: 'DELETE',
      data: JSON.stringify([{ cad_trust_stakeholder_id: id }]), // Use UUID string directly
      committed: false,
      failed_commit: false,
      is_transfer: false,
    });

    res.json({
      message: 'Stakeholder delete staged successfully',
      success: true,
    });
  } catch (err) {
    loggerV2.error('[v2]: Error deleting stakeholder:', err);
    res.status(400).json({
      message: 'Error deleting stakeholder',
      error: err.message,
      success: false,
    });
  }
};
