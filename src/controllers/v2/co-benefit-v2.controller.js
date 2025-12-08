'use strict';

import { CoBenefitV2, CoBenefitV2Mirror, ProjectV2 } from '../../models/v2/index.js';
import { coBenefitV2Schema } from '../../validations/v2/co-benefit-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';
import { v4 as uuidv4 } from 'uuid';

export const createCoBenefitV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = coBenefitV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign key: Project must exist
    const projectExists = await assertRecordExistanceOrStaged(
      ProjectV2,
      value.cadTrustProjectId,
      'ProjectV2 does not have a record'
    );
    if (!projectExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['ProjectV2 does not have a record'],
      });
    }

    // Generate UUID for the co-benefit
    const cadTrustCoBenefitId = uuidv4();

    // Create co-benefit in staging table
    const coBenefit = await CoBenefitV2Mirror.create({
      cadTrustCoBenefitId,
      coBenefitId: value.coBenefitId,
      cadTrustProjectId: value.cadTrustProjectId,
    });

    res.status(201).json({
      success: true,
      message: 'Co-Benefit created successfully',
      cadTrustCoBenefitId,
      data: coBenefit,
    });
  } catch (error) {
    console.error('Error creating co-benefit:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getCoBenefitV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid co-benefit ID format',
      });
    }

    const coBenefit = await CoBenefitV2.findByPk(id);

    if (!coBenefit) {
      return res.status(404).json({
        success: false,
        message: 'Co-Benefit not found',
      });
    }

    res.status(200).json({
      success: true,
      data: coBenefit,
    });
  } catch (error) {
    console.error('Error fetching co-benefit:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllCoBenefitsV2 = async (req, res) => {
  try {
    const coBenefits = await CoBenefitV2.findAll({
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: coBenefits,
      count: coBenefits.length,
    });
  } catch (error) {
    console.error('Error fetching co-benefits:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateCoBenefitV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid co-benefit ID format',
      });
    }

    // Validate request body
    const { error, value } = coBenefitV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign key: Project must exist
    const projectExists = await assertRecordExistanceOrStaged(
      ProjectV2,
      value.cadTrustProjectId,
      'ProjectV2 does not have a record'
    );
    if (!projectExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['ProjectV2 does not have a record'],
      });
    }

    // Check if co-benefit exists
    const existingCoBenefit = await CoBenefitV2Mirror.findByPk(id);
    if (!existingCoBenefit) {
      return res.status(404).json({
        success: false,
        message: 'Co-Benefit not found',
      });
    }

    // Update co-benefit in staging table
    await existingCoBenefit.update({
      coBenefitId: value.coBenefitId,
      cadTrustProjectId: value.cadTrustProjectId,
    });

    res.status(200).json({
      success: true,
      message: 'Co-Benefit updated successfully',
      data: existingCoBenefit,
    });
  } catch (error) {
    console.error('Error updating co-benefit:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteCoBenefitV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid co-benefit ID format',
      });
    }

    // Check if co-benefit exists
    const coBenefit = await CoBenefitV2Mirror.findByPk(id);
    if (!coBenefit) {
      return res.status(404).json({
        success: false,
        message: 'Co-Benefit not found',
      });
    }

    // Delete co-benefit from staging table
    await coBenefit.destroy();

    res.status(200).json({
      success: true,
      message: 'Co-Benefit deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting co-benefit:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
