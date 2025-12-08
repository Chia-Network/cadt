'use strict';

import { LabelV2, LabelV2Mirror } from '../../models/v2/index.js';
import { labelV2Schema } from '../../validations/v2/label-v2.validations.js';
import { v4 as uuidv4 } from 'uuid';

export const createLabelV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = labelV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Generate UUID for the label
    const cadTrustLabelId = uuidv4();

    // Create label in staging table
    const label = await LabelV2Mirror.create({
      cadTrustLabelId,
      labelName: value.labelName,
      labelType: value.labelType,
      labelLink: value.labelLink,
      labelDate: value.labelDate,
    });

    res.status(201).json({
      success: true,
      message: 'Label created successfully',
      cadTrustLabelId,
      data: label,
    });
  } catch (error) {
    console.error('Error creating label:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getLabelV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid label ID format',
      });
    }

    const label = await LabelV2.findByPk(id);

    if (!label) {
      return res.status(404).json({
        success: false,
        message: 'Label not found',
      });
    }

    res.status(200).json({
      success: true,
      data: label,
    });
  } catch (error) {
    console.error('Error fetching label:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllLabelsV2 = async (req, res) => {
  try {
    const labels = await LabelV2.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: labels,
      count: labels.length,
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateLabelV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid label ID format',
      });
    }

    // Validate request body
    const { error, value } = labelV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Check if label exists
    const existingLabel = await LabelV2Mirror.findByPk(id);
    if (!existingLabel) {
      return res.status(404).json({
        success: false,
        message: 'Label not found',
      });
    }

    // Update label in staging table
    await existingLabel.update({
      labelName: value.labelName,
      labelType: value.labelType,
      labelLink: value.labelLink,
      labelDate: value.labelDate,
    });

    res.status(200).json({
      success: true,
      message: 'Label updated successfully',
      data: existingLabel,
    });
  } catch (error) {
    console.error('Error updating label:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteLabelV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid label ID format',
      });
    }

    // Check if label exists
    const label = await LabelV2Mirror.findByPk(id);
    if (!label) {
      return res.status(404).json({
        success: false,
        message: 'Label not found',
      });
    }

    // Delete label from staging table
    await label.destroy();

    res.status(200).json({
      success: true,
      message: 'Label deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting label:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
