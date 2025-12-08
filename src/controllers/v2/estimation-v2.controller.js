'use strict';

import { EstimationV2, EstimationV2Mirror, ProjectV2 } from '../../models/v2/index.js';
import { estimationV2Schema } from '../../validations/v2/estimation-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';
import { v4 as uuidv4 } from 'uuid';

export const createEstimationV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = estimationV2Schema.validate(req.body);
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

    // Generate UUID for the estimation
    const cadTrustEstimationId = uuidv4();

    // Create estimation in staging table
    const estimation = await EstimationV2Mirror.create({
      cadTrustEstimationId,
      estimationStartDate: value.estimationStartDate,
      estimationEndDate: value.estimationEndDate,
      estimationUnitCount: value.estimationUnitCount,
      estimationReferenceNo: value.estimationReferenceNo,
      cadTrustProjectId: value.cadTrustProjectId,
    });

    res.status(201).json({
      success: true,
      message: 'Estimation created successfully',
      cadTrustEstimationId,
      data: estimation,
    });
  } catch (error) {
    console.error('Error creating estimation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getEstimationV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimation ID format',
      });
    }

    const estimation = await EstimationV2.findByPk(id, {
      include: [
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistry'],
        },
      ],
    });

    if (!estimation) {
      return res.status(404).json({
        success: false,
        message: 'Estimation not found',
      });
    }

    res.status(200).json({
      success: true,
      data: estimation,
    });
  } catch (error) {
    console.error('Error fetching estimation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllEstimationsV2 = async (req, res) => {
  try {
    const estimations = await EstimationV2.findAll({
      include: [
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistry'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: estimations,
      count: estimations.length,
    });
  } catch (error) {
    console.error('Error fetching estimations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateEstimationV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimation ID format',
      });
    }

    // Validate request body
    const { error, value } = estimationV2Schema.validate(req.body);
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

    // Check if estimation exists
    const existingEstimation = await EstimationV2Mirror.findByPk(id);
    if (!existingEstimation) {
      return res.status(404).json({
        success: false,
        message: 'Estimation not found',
      });
    }

    // Update estimation in staging table
    await existingEstimation.update({
      estimationStartDate: value.estimationStartDate,
      estimationEndDate: value.estimationEndDate,
      estimationUnitCount: value.estimationUnitCount,
      estimationReferenceNo: value.estimationReferenceNo,
      cadTrustProjectId: value.cadTrustProjectId,
    });

    res.status(200).json({
      success: true,
      message: 'Estimation updated successfully',
      data: existingEstimation,
    });
  } catch (error) {
    console.error('Error updating estimation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteEstimationV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid estimation ID format',
      });
    }

    // Check if estimation exists
    const estimation = await EstimationV2Mirror.findByPk(id);
    if (!estimation) {
      return res.status(404).json({
        success: false,
        message: 'Estimation not found',
      });
    }

    // Delete estimation from staging table
    await estimation.destroy();

    res.status(200).json({
      success: true,
      message: 'Estimation deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting estimation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
