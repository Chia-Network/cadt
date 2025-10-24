'use strict';

import { RatingV2, RatingV2Mirror, ProjectV2 } from '../../models/v2/index.js';
import { ratingV2Schema } from '../../validations/v2/rating-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';
import { v4 as uuidv4 } from 'uuid';

export const createRatingV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = ratingV2Schema.validate(req.body);
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

    // Generate UUID for the rating
    const ratingId = uuidv4();

    // Create rating in staging table
    const rating = await RatingV2Mirror.create({
      cadTrustRatingId: ratingId,
      ratingType: value.ratingType,
      ratingValue: value.ratingValue,
      ratingLink: value.ratingLink,
      cadTrustProjectId: value.cadTrustProjectId,
    });

    res.status(201).json({
      success: true,
      message: 'Rating created successfully',
      data: rating,
    });
  } catch (error) {
    console.error('Error creating rating:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
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

    const rating = await RatingV2.findByPk(id, {
      include: [
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
        },
      ],
    });

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found',
      });
    }

    res.status(200).json({
      success: true,
      data: rating,
    });
  } catch (error) {
    console.error('Error fetching rating:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllRatingsV2 = async (req, res) => {
  try {
    const ratings = await RatingV2.findAll({
      include: [
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: ratings,
      count: ratings.length,
    });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateRatingV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rating ID format',
      });
    }

    // Validate request body
    const { error, value } = ratingV2Schema.validate(req.body);
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

    // Check if rating exists
    const existingRating = await RatingV2Mirror.findByPk(id);
    if (!existingRating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found',
      });
    }

    // Update rating in staging table
    await existingRating.update({
      ratingType: value.ratingType,
      ratingValue: value.ratingValue,
      ratingLink: value.ratingLink,
      cadTrustProjectId: value.cadTrustProjectId,
    });

    res.status(200).json({
      success: true,
      message: 'Rating updated successfully',
      data: existingRating,
    });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteRatingV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rating ID format',
      });
    }

    // Check if rating exists
    const rating = await RatingV2Mirror.findByPk(id);
    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found',
      });
    }

    // Delete rating from staging table
    await rating.destroy();

    res.status(200).json({
      success: true,
      message: 'Rating deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
