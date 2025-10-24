'use strict';

import { UnitLabelV2, UnitLabelV2Mirror, LabelV2, UnitV2 } from '../../models/v2/index.js';
import { unitLabelV2Schema } from '../../validations/v2/unit-label-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';

export const createUnitLabelV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = unitLabelV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign keys: Both Label and Unit must exist
    const labelExists = await assertRecordExistanceOrStaged(
      LabelV2,
      value.cadTrustLabelId,
      'LabelV2 does not have a record'
    );
    if (!labelExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['LabelV2 does not have a record'],
      });
    }

    const unitExists = await assertRecordExistanceOrStaged(
      UnitV2,
      value.cadTrustUnitId,
      'UnitV2 does not have a record'
    );
    if (!unitExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['UnitV2 does not have a record'],
      });
    }

    // Check if the relationship already exists
    const existingRelation = await UnitLabelV2Mirror.findOne({
      where: {
        cadTrustLabelId: value.cadTrustLabelId,
        cadTrustUnitId: value.cadTrustUnitId,
      },
    });

    if (existingRelation) {
      return res.status(409).json({
        success: false,
        message: 'Unit-Label relationship already exists',
        errors: ['This unit-label combination already exists'],
      });
    }

    // Create unit-label relationship in staging table
    const unitLabel = await UnitLabelV2Mirror.create({
      cadTrustLabelId: value.cadTrustLabelId,
      cadTrustUnitId: value.cadTrustUnitId,
      labelUnitDate: value.labelUnitDate,
      labelUnitDescription: value.labelUnitDescription,
    });

    res.status(201).json({
      success: true,
      message: 'Unit-Label relationship created successfully',
      data: unitLabel,
    });
  } catch (error) {
    console.error('Error creating unit-label relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getUnitLabelV2 = async (req, res) => {
  try {
    const { cadTrustLabelId, cadTrustUnitId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustLabelId.match(uuidRegex) || !cadTrustUnitId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid unit-label ID format',
      });
    }

    const unitLabel = await UnitLabelV2.findOne({
      where: {
        cadTrustLabelId,
        cadTrustUnitId,
      },
      include: [
        {
          model: LabelV2,
          as: 'label',
          attributes: ['cadTrustLabelId', 'labelName', 'labelType'],
        },
        {
          model: UnitV2,
          as: 'unit',
          attributes: ['cadTrustUnitId', 'unitSerialId', 'unitType', 'unitVintageYear'],
        },
      ],
    });

    if (!unitLabel) {
      return res.status(404).json({
        success: false,
        message: 'Unit-Label relationship not found',
      });
    }

    res.status(200).json({
      success: true,
      data: unitLabel,
    });
  } catch (error) {
    console.error('Error fetching unit-label relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllUnitLabelsV2 = async (req, res) => {
  try {
    const unitLabels = await UnitLabelV2.findAll({
      include: [
        {
          model: LabelV2,
          as: 'label',
          attributes: ['cadTrustLabelId', 'labelName', 'labelType'],
        },
        {
          model: UnitV2,
          as: 'unit',
          attributes: ['cadTrustUnitId', 'unitSerialId', 'unitType', 'unitVintageYear'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: unitLabels,
      count: unitLabels.length,
    });
  } catch (error) {
    console.error('Error fetching unit-label relationships:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateUnitLabelV2 = async (req, res) => {
  try {
    const { cadTrustLabelId, cadTrustUnitId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustLabelId.match(uuidRegex) || !cadTrustUnitId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid unit-label ID format',
      });
    }

    // Validate request body
    const { error, value } = unitLabelV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign keys: Both Label and Unit must exist
    const labelExists = await assertRecordExistanceOrStaged(
      LabelV2,
      value.cadTrustLabelId,
      'LabelV2 does not have a record'
    );
    if (!labelExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['LabelV2 does not have a record'],
      });
    }

    const unitExists = await assertRecordExistanceOrStaged(
      UnitV2,
      value.cadTrustUnitId,
      'UnitV2 does not have a record'
    );
    if (!unitExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['UnitV2 does not have a record'],
      });
    }

    // Check if unit-label relationship exists
    const existingRelation = await UnitLabelV2Mirror.findOne({
      where: {
        cadTrustLabelId,
        cadTrustUnitId,
      },
    });
    if (!existingRelation) {
      return res.status(404).json({
        success: false,
        message: 'Unit-Label relationship not found',
      });
    }

    // Check if the new combination would create a duplicate
    const duplicateCheck = await UnitLabelV2Mirror.findOne({
      where: {
        cadTrustLabelId: value.cadTrustLabelId,
        cadTrustUnitId: value.cadTrustUnitId,
        [require('sequelize').Op.and]: [
          { cadTrustLabelId: { [require('sequelize').Op.ne]: cadTrustLabelId } },
          { cadTrustUnitId: { [require('sequelize').Op.ne]: cadTrustUnitId } },
        ],
      },
    });

    if (duplicateCheck) {
      return res.status(409).json({
        success: false,
        message: 'Unit-Label relationship already exists',
        errors: ['This unit-label combination already exists'],
      });
    }

    // Update unit-label relationship in staging table
    await existingRelation.update({
      cadTrustLabelId: value.cadTrustLabelId,
      cadTrustUnitId: value.cadTrustUnitId,
      labelUnitDate: value.labelUnitDate,
      labelUnitDescription: value.labelUnitDescription,
    });

    res.status(200).json({
      success: true,
      message: 'Unit-Label relationship updated successfully',
      data: existingRelation,
    });
  } catch (error) {
    console.error('Error updating unit-label relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteUnitLabelV2 = async (req, res) => {
  try {
    const { cadTrustLabelId, cadTrustUnitId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustLabelId.match(uuidRegex) || !cadTrustUnitId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid unit-label ID format',
      });
    }

    // Check if unit-label relationship exists
    const unitLabel = await UnitLabelV2Mirror.findOne({
      where: {
        cadTrustLabelId,
        cadTrustUnitId,
      },
    });
    if (!unitLabel) {
      return res.status(404).json({
        success: false,
        message: 'Unit-Label relationship not found',
      });
    }

    // Delete unit-label relationship from staging table
    await unitLabel.destroy();

    res.status(200).json({
      success: true,
      message: 'Unit-Label relationship deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting unit-label relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
