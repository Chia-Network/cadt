'use strict';

import { StakeholderV2, StakeholderV2Mirror } from '../../models/v2/index.js';
import { stakeholderV2Schema } from '../../validations/v2/stakeholder-v2.validations.js';
import { v4 as uuidv4 } from 'uuid';

export const createStakeholderV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = stakeholderV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Generate UUID for the stakeholder
    const stakeholderId = uuidv4();

    // Create stakeholder in staging table
    const stakeholder = await StakeholderV2Mirror.create({
      cadTrustStakeholderId: stakeholderId,
      stakeholderName: value.stakeholderName,
      stakeholderType: value.stakeholderType,
      stakeholderLink: value.stakeholderLink,
    });

    res.status(201).json({
      success: true,
      message: 'Stakeholder created successfully',
      data: stakeholder,
    });
  } catch (error) {
    console.error('Error creating stakeholder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getStakeholderV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stakeholder ID format',
      });
    }

    const stakeholder = await StakeholderV2.findByPk(id);

    if (!stakeholder) {
      return res.status(404).json({
        success: false,
        message: 'Stakeholder not found',
      });
    }

    res.status(200).json({
      success: true,
      data: stakeholder,
    });
  } catch (error) {
    console.error('Error fetching stakeholder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllStakeholdersV2 = async (req, res) => {
  try {
    const stakeholders = await StakeholderV2.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: stakeholders,
      count: stakeholders.length,
    });
  } catch (error) {
    console.error('Error fetching stakeholders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateStakeholderV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stakeholder ID format',
      });
    }

    // Validate request body
    const { error, value } = stakeholderV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Check if stakeholder exists
    const existingStakeholder = await StakeholderV2Mirror.findByPk(id);
    if (!existingStakeholder) {
      return res.status(404).json({
        success: false,
        message: 'Stakeholder not found',
      });
    }

    // Update stakeholder in staging table
    await existingStakeholder.update({
      stakeholderName: value.stakeholderName,
      stakeholderType: value.stakeholderType,
      stakeholderLink: value.stakeholderLink,
    });

    res.status(200).json({
      success: true,
      message: 'Stakeholder updated successfully',
      data: existingStakeholder,
    });
  } catch (error) {
    console.error('Error updating stakeholder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteStakeholderV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stakeholder ID format',
      });
    }

    // Check if stakeholder exists
    const stakeholder = await StakeholderV2Mirror.findByPk(id);
    if (!stakeholder) {
      return res.status(404).json({
        success: false,
        message: 'Stakeholder not found',
      });
    }

    // Delete stakeholder from staging table
    await stakeholder.destroy();

    res.status(200).json({
      success: true,
      message: 'Stakeholder deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting stakeholder:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
