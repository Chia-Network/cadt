'use strict';

import { AefT2AuthorizationsV2, AefT2AuthorizationsV2Mirror, AefT1SubmissionV2, UnitV2, ProjectV2, AefT5AuthorizedEntitiesV2 } from '../../models/v2/index.js';
import { aefT2AuthorizationsV2Schema } from '../../validations/v2/aef-t2-authorizations-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';

export const createAefT2AuthorizationsV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = aefT2AuthorizationsV2Schema.validate(req.body);
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

    if (value.cadTrustAefT5AuthorizedEntitiesId) {
      const aefT5AuthorizedEntitiesExists = await assertRecordExistanceOrStaged(
        AefT5AuthorizedEntitiesV2,
        value.cadTrustAefT5AuthorizedEntitiesId,
        'AefT5AuthorizedEntitiesV2 does not have a record'
      );
      if (!aefT5AuthorizedEntitiesExists) {
        return res.status(400).json({
          success: false,
          message: 'Foreign key validation failed',
          errors: ['AefT5AuthorizedEntitiesV2 does not have a record'],
        });
      }
    }

    // Create AEF-T2-Authorizations in staging table
    const aefT2Authorizations = await AefT2AuthorizationsV2Mirror.create(value);

    res.status(201).json({
      success: true,
      message: 'AEF-T2-Authorizations staged successfully',
      cadTrustAefT2AuthorizationsId: aefT2Authorizations.cadTrustAefT2AuthorizationsId,
      data: aefT2Authorizations,
    });
  } catch (error) {
    console.error('Error creating AEF-T2-Authorizations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAefT2AuthorizationsV2 = async (req, res) => {
  try {
    const { cadTrustAefT2AuthorizationsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT2AuthorizationsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T2-Authorizations ID format',
      });
    }

    const aefT2Authorizations = await AefT2AuthorizationsV2.findByPk(cadTrustAefT2AuthorizationsId, {
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
          model: AefT5AuthorizedEntitiesV2,
          as: 'aefT5AuthorizedEntities',
          attributes: ['cadTrustAefT5AuthorizedEntitiesId', 'aefT5AuthorizedEntitiesName', 'aefT5AuthorizedEntitiesId'],
        },
      ],
    });

    if (!aefT2Authorizations) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T2-Authorizations not found',
      });
    }

    res.status(200).json({
      success: true,
      data: aefT2Authorizations,
    });
  } catch (error) {
    console.error('Error fetching AEF-T2-Authorizations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllAefT2AuthorizationsV2 = async (req, res) => {
  try {
    const aefT2Authorizations = await AefT2AuthorizationsV2.findAll({
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
          model: AefT5AuthorizedEntitiesV2,
          as: 'aefT5AuthorizedEntities',
          attributes: ['cadTrustAefT5AuthorizedEntitiesId', 'aefT5AuthorizedEntitiesName', 'aefT5AuthorizedEntitiesId'],
        },
      ],
      order: [['aefT2AuthorizationsDate', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: aefT2Authorizations,
      count: aefT2Authorizations.length,
    });
  } catch (error) {
    console.error('Error fetching AEF-T2-Authorizations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateAefT2AuthorizationsV2 = async (req, res) => {
  try {
    const { cadTrustAefT2AuthorizationsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT2AuthorizationsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T2-Authorizations ID format',
      });
    }

    // Validate request body
    const { error, value } = aefT2AuthorizationsV2Schema.validate(req.body);
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

    if (value.cadTrustAefT5AuthorizedEntitiesId) {
      const aefT5AuthorizedEntitiesExists = await assertRecordExistanceOrStaged(
        AefT5AuthorizedEntitiesV2,
        value.cadTrustAefT5AuthorizedEntitiesId,
        'AefT5AuthorizedEntitiesV2 does not have a record'
      );
      if (!aefT5AuthorizedEntitiesExists) {
        return res.status(400).json({
          success: false,
          message: 'Foreign key validation failed',
          errors: ['AefT5AuthorizedEntitiesV2 does not have a record'],
        });
      }
    }

    // Check if AEF-T2-Authorizations exists
    const existingAefT2Authorizations = await AefT2AuthorizationsV2Mirror.findByPk(cadTrustAefT2AuthorizationsId);
    if (!existingAefT2Authorizations) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T2-Authorizations not found',
      });
    }

    // Update AEF-T2-Authorizations in staging table
    await existingAefT2Authorizations.update(value);

    res.status(200).json({
      success: true,
      message: 'AEF-T2-Authorizations updated successfully',
      data: existingAefT2Authorizations,
    });
  } catch (error) {
    console.error('Error updating AEF-T2-Authorizations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteAefT2AuthorizationsV2 = async (req, res) => {
  try {
    const { cadTrustAefT2AuthorizationsId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT2AuthorizationsId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T2-Authorizations ID format',
      });
    }

    // Check if AEF-T2-Authorizations exists
    const aefT2Authorizations = await AefT2AuthorizationsV2Mirror.findByPk(cadTrustAefT2AuthorizationsId);
    if (!aefT2Authorizations) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T2-Authorizations not found',
      });
    }

    // Delete AEF-T2-Authorizations from staging table
    await aefT2Authorizations.destroy();

    res.status(200).json({
      success: true,
      message: 'AEF-T2-Authorizations deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting AEF-T2-Authorizations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
