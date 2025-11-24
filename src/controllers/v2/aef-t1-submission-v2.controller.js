'use strict';

import { AefT1SubmissionV2, AefT1SubmissionV2Mirror } from '../../models/v2/index.js';
import { aefT1SubmissionV2Schema } from '../../validations/v2/aef-t1-submission-v2.validations.js';

export const createAefT1SubmissionV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = aefT1SubmissionV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Create AEF-T1-Submission in staging table
    const aefT1Submission = await AefT1SubmissionV2Mirror.create(value);

    res.status(201).json({
      success: true,
      message: 'AEF-T1-Submission staged successfully',
      data: aefT1Submission,
    });
  } catch (error) {
    console.error('Error creating AEF-T1-Submission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAefT1SubmissionV2 = async (req, res) => {
  try {
    const { cadTrustAefT1SubmissionId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT1SubmissionId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T1-Submission ID format',
      });
    }

    const aefT1Submission = await AefT1SubmissionV2.findByPk(cadTrustAefT1SubmissionId);

    if (!aefT1Submission) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T1-Submission not found',
      });
    }

    res.status(200).json({
      success: true,
      data: aefT1Submission,
    });
  } catch (error) {
    console.error('Error fetching AEF-T1-Submission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllAefT1SubmissionsV2 = async (req, res) => {
  try {
    const aefT1Submissions = await AefT1SubmissionV2.findAll({
      order: [['aefT1SubmissionSubmissionDate', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: aefT1Submissions,
      count: aefT1Submissions.length,
    });
  } catch (error) {
    console.error('Error fetching AEF-T1-Submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateAefT1SubmissionV2 = async (req, res) => {
  try {
    const { cadTrustAefT1SubmissionId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT1SubmissionId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T1-Submission ID format',
      });
    }

    // Validate request body
    const { error, value } = aefT1SubmissionV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Check if AEF-T1-Submission exists
    const existingAefT1Submission = await AefT1SubmissionV2Mirror.findByPk(cadTrustAefT1SubmissionId);
    if (!existingAefT1Submission) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T1-Submission not found',
      });
    }

    // Update AEF-T1-Submission in staging table
    await existingAefT1Submission.update(value);

    res.status(200).json({
      success: true,
      message: 'AEF-T1-Submission updated successfully',
      data: existingAefT1Submission,
    });
  } catch (error) {
    console.error('Error updating AEF-T1-Submission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteAefT1SubmissionV2 = async (req, res) => {
  try {
    const { cadTrustAefT1SubmissionId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT1SubmissionId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T1-Submission ID format',
      });
    }

    // Check if AEF-T1-Submission exists
    const aefT1Submission = await AefT1SubmissionV2Mirror.findByPk(cadTrustAefT1SubmissionId);
    if (!aefT1Submission) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T1-Submission not found',
      });
    }

    // Delete AEF-T1-Submission from staging table
    await aefT1Submission.destroy();

    res.status(200).json({
      success: true,
      message: 'AEF-T1-Submission deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting AEF-T1-Submission:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
