'use strict';

import { AefT3ActionsV2, AefT3ActionsV2Mirror, AefT1SubmissionV2, UnitV2, ProjectV2, AefT2AuthorizationsV2 } from '../../models/v2/index.js';
import { aefT3ActionsV2Schema } from '../../validations/v2/aef-t3-actions-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';

export const createAefT3ActionsV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = aefT3ActionsV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign keys if provided
    if (value.cadTrustAefT1SubmissionId) {
      const aefT1SubmissionExists = await assertRecordExistanceOrStaged(
        AefT1SubmissionV2,
        value.cadTrustAefT1SubmissionId,
        'AefT1SubmissionV2 does not have a record'
      );
      if (!aefT1SubmissionExists) {
        return res.status(400).json({
          success: false,
          message: 'Foreign key validation failed',
          errors: ['AefT1SubmissionV2 does not have a record'],
        });
      }
    }

    if (value.cadTrustUnitId) {
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
    }

    if (value.cadTrustProjectId) {
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
    }

    if (value.cadTrustAefT2AuthorizationsId) {
      const aefT2AuthorizationsExists = await assertRecordExistanceOrStaged(
        AefT2AuthorizationsV2,
        value.cadTrustAefT2AuthorizationsId,
        'AefT2AuthorizationsV2 does not have a record'
      );
      if (!aefT2AuthorizationsExists) {
        return res.status(400).json({
          success: false,
          message: 'Foreign key validation failed',
          errors: ['AefT2AuthorizationsV2 does not have a record'],
        });
      }
    }

    // Create AEF-T3-Actions in staging table
    const aefT3Actions = await AefT3ActionsV2Mirror.create(value);

    res.status(201).json({
      success: true,
      message: 'AEF-T3-Actions staged successfully',
      cadTrustAefT3ActionsId: aefT3Actions.cadTrustAefT3ActionsId,
      data: aefT3Actions,
    });
  } catch (error) {
    console.error('Error creating AEF-T3-Actions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAefT3ActionsV2 = async (req, res) => {
  try {
    const { cadTrustAefT3ActionsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT3ActionsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T3-Actions ID format',
      });
    }

    const aefT3Actions = await AefT3ActionsV2.findByPk(cadTrustAefT3ActionsId, {
      include: [
        {
          model: AefT1SubmissionV2,
          as: 'aefT1Submission',
          attributes: ['cadTrustAefT1SubmissionId', 'aefT1SubmissionParty', 'aefT1SubmissionVersion'],
        },
        {
          model: UnitV2,
          as: 'unit',
          attributes: ['cadTrustUnitId', 'unitSerialId', 'unitType', 'unitVintageYear'],
        },
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectSector', 'projectType'],
        },
        {
          model: AefT2AuthorizationsV2,
          as: 'aefT2Authorizations',
          attributes: ['cadTrustAefT2AuthorizationsId', 'aefT2AuthorizationsId', 'aefT2AuthorizationsDate'],
        },
      ],
    });

    if (!aefT3Actions) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T3-Actions not found',
      });
    }

    res.status(200).json({
      success: true,
      data: aefT3Actions,
    });
  } catch (error) {
    console.error('Error fetching AEF-T3-Actions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllAefT3ActionsV2 = async (req, res) => {
  try {
    const aefT3Actions = await AefT3ActionsV2.findAll({
      include: [
        {
          model: AefT1SubmissionV2,
          as: 'aefT1Submission',
          attributes: ['cadTrustAefT1SubmissionId', 'aefT1SubmissionParty', 'aefT1SubmissionVersion'],
        },
        {
          model: UnitV2,
          as: 'unit',
          attributes: ['cadTrustUnitId', 'unitSerialId', 'unitType', 'unitVintageYear'],
        },
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectSector', 'projectType'],
        },
        {
          model: AefT2AuthorizationsV2,
          as: 'aefT2Authorizations',
          attributes: ['cadTrustAefT2AuthorizationsId', 'aefT2AuthorizationsId', 'aefT2AuthorizationsDate'],
        },
      ],
      order: [['aefT3ActionsDate', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: aefT3Actions,
      count: aefT3Actions.length,
    });
  } catch (error) {
    console.error('Error fetching AEF-T3-Actions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateAefT3ActionsV2 = async (req, res) => {
  try {
    const { cadTrustAefT3ActionsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT3ActionsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T3-Actions ID format',
      });
    }

    // Validate request body
    const { error, value } = aefT3ActionsV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign keys if provided
    if (value.cadTrustAefT1SubmissionId) {
      const aefT1SubmissionExists = await assertRecordExistanceOrStaged(
        AefT1SubmissionV2,
        value.cadTrustAefT1SubmissionId,
        'AefT1SubmissionV2 does not have a record'
      );
      if (!aefT1SubmissionExists) {
        return res.status(400).json({
          success: false,
          message: 'Foreign key validation failed',
          errors: ['AefT1SubmissionV2 does not have a record'],
        });
      }
    }

    if (value.cadTrustUnitId) {
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
    }

    if (value.cadTrustProjectId) {
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
    }

    if (value.cadTrustAefT2AuthorizationsId) {
      const aefT2AuthorizationsExists = await assertRecordExistanceOrStaged(
        AefT2AuthorizationsV2,
        value.cadTrustAefT2AuthorizationsId,
        'AefT2AuthorizationsV2 does not have a record'
      );
      if (!aefT2AuthorizationsExists) {
        return res.status(400).json({
          success: false,
          message: 'Foreign key validation failed',
          errors: ['AefT2AuthorizationsV2 does not have a record'],
        });
      }
    }

    // Check if AEF-T3-Actions exists
    const existingAefT3Actions = await AefT3ActionsV2Mirror.findByPk(cadTrustAefT3ActionsId);
    if (!existingAefT3Actions) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T3-Actions not found',
      });
    }

    // Update AEF-T3-Actions in staging table
    await existingAefT3Actions.update(value);

    res.status(200).json({
      success: true,
      message: 'AEF-T3-Actions updated successfully',
      data: existingAefT3Actions,
    });
  } catch (error) {
    console.error('Error updating AEF-T3-Actions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteAefT3ActionsV2 = async (req, res) => {
  try {
    const { cadTrustAefT3ActionsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT3ActionsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T3-Actions ID format',
      });
    }

    // Check if AEF-T3-Actions exists
    const aefT3Actions = await AefT3ActionsV2Mirror.findByPk(cadTrustAefT3ActionsId);
    if (!aefT3Actions) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T3-Actions not found',
      });
    }

    // Delete AEF-T3-Actions from staging table
    await aefT3Actions.destroy();

    res.status(200).json({
      success: true,
      message: 'AEF-T3-Actions deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting AEF-T3-Actions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
