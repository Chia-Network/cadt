'use strict';

import { AefT4HoldingsV2, AefT4HoldingsV2Mirror, AefT1SubmissionV2, UnitV2, ProjectV2, AefT2AuthorizationsV2 } from '../../models/v2/index.js';
import { aefT4HoldingsV2Schema } from '../../validations/v2/aef-t4-holdings-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';

export const createAefT4HoldingsV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = aefT4HoldingsV2Schema.validate(req.body);
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

    // Create AEF-T4-Holdings in staging table
    const aefT4Holdings = await AefT4HoldingsV2Mirror.create(value);

    res.status(201).json({
      success: true,
      message: 'AEF-T4-Holdings staged successfully',
      cadTrustAefT4HoldingsId: aefT4Holdings.cadTrustAefT4HoldingsId,
      data: aefT4Holdings,
    });
  } catch (error) {
    console.error('Error creating AEF-T4-Holdings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAefT4HoldingsV2 = async (req, res) => {
  try {
    const { cadTrustAefT4HoldingsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT4HoldingsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T4-Holdings ID format',
      });
    }

    const aefT4Holdings = await AefT4HoldingsV2.findByPk(cadTrustAefT4HoldingsId, {
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

    if (!aefT4Holdings) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T4-Holdings not found',
      });
    }

    res.status(200).json({
      success: true,
      data: aefT4Holdings,
    });
  } catch (error) {
    console.error('Error fetching AEF-T4-Holdings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllAefT4HoldingsV2 = async (req, res) => {
  try {
    const aefT4Holdings = await AefT4HoldingsV2.findAll({
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
      order: [['aefT4HoldingsVintageYear', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: aefT4Holdings,
      count: aefT4Holdings.length,
    });
  } catch (error) {
    console.error('Error fetching AEF-T4-Holdings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateAefT4HoldingsV2 = async (req, res) => {
  try {
    const { cadTrustAefT4HoldingsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT4HoldingsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T4-Holdings ID format',
      });
    }

    // Validate request body
    const { error, value } = aefT4HoldingsV2Schema.validate(req.body);
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

    // Check if AEF-T4-Holdings exists
    const existingAefT4Holdings = await AefT4HoldingsV2Mirror.findByPk(cadTrustAefT4HoldingsId);
    if (!existingAefT4Holdings) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T4-Holdings not found',
      });
    }

    // Update AEF-T4-Holdings in staging table
    await existingAefT4Holdings.update(value);

    res.status(200).json({
      success: true,
      message: 'AEF-T4-Holdings updated successfully',
      data: existingAefT4Holdings,
    });
  } catch (error) {
    console.error('Error updating AEF-T4-Holdings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteAefT4HoldingsV2 = async (req, res) => {
  try {
    const { cadTrustAefT4HoldingsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT4HoldingsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T4-Holdings ID format',
      });
    }

    // Check if AEF-T4-Holdings exists
    const aefT4Holdings = await AefT4HoldingsV2Mirror.findByPk(cadTrustAefT4HoldingsId);
    if (!aefT4Holdings) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T4-Holdings not found',
      });
    }

    // Delete AEF-T4-Holdings from staging table
    await aefT4Holdings.destroy();

    res.status(200).json({
      success: true,
      message: 'AEF-T4-Holdings deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting AEF-T4-Holdings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
