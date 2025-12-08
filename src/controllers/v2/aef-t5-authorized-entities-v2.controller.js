'use strict';

import { AefT5AuthorizedEntitiesV2, AefT5AuthorizedEntitiesV2Mirror, AefT1SubmissionV2, UnitV2, ProjectV2 } from '../../models/v2/index.js';
import { aefT5AuthorizedEntitiesV2Schema } from '../../validations/v2/aef-t5-authorized-entities-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';

export const createAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = aefT5AuthorizedEntitiesV2Schema.validate(req.body);
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

    // Create AEF-T5-Authorized-Entities in staging table
    const aefT5AuthorizedEntities = await AefT5AuthorizedEntitiesV2Mirror.create(value);

    res.status(201).json({
      success: true,
      message: 'AEF-T5-Authorized-Entities staged successfully',
      cadTrustAefT5AuthorizedEntitiesId: aefT5AuthorizedEntities.cadTrustAefT5AuthorizedEntitiesId,
      data: aefT5AuthorizedEntities,
    });
  } catch (error) {
    console.error('Error creating AEF-T5-Authorized-Entities:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    const { cadTrustAefT5AuthorizedEntitiesId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT5AuthorizedEntitiesId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T5-Authorized-Entities ID format',
      });
    }

    const aefT5AuthorizedEntities = await AefT5AuthorizedEntitiesV2.findByPk(cadTrustAefT5AuthorizedEntitiesId, {
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
      ],
    });

    if (!aefT5AuthorizedEntities) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T5-Authorized-Entities not found',
      });
    }

    res.status(200).json({
      success: true,
      data: aefT5AuthorizedEntities,
    });
  } catch (error) {
    console.error('Error fetching AEF-T5-Authorized-Entities:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    const aefT5AuthorizedEntities = await AefT5AuthorizedEntitiesV2.findAll({
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
      ],
      order: [['aefT5AuthorizedEntitiesAuthorizationDate', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: aefT5AuthorizedEntities,
      count: aefT5AuthorizedEntities.length,
    });
  } catch (error) {
    console.error('Error fetching AEF-T5-Authorized-Entities:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    const { cadTrustAefT5AuthorizedEntitiesId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT5AuthorizedEntitiesId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T5-Authorized-Entities ID format',
      });
    }

    // Validate request body
    const { error, value } = aefT5AuthorizedEntitiesV2Schema.validate(req.body);
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

    // Check if AEF-T5-Authorized-Entities exists
    const existingAefT5AuthorizedEntities = await AefT5AuthorizedEntitiesV2Mirror.findByPk(cadTrustAefT5AuthorizedEntitiesId);
    if (!existingAefT5AuthorizedEntities) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T5-Authorized-Entities not found',
      });
    }

    // Update AEF-T5-Authorized-Entities in staging table
    await existingAefT5AuthorizedEntities.update(value);

    res.status(200).json({
      success: true,
      message: 'AEF-T5-Authorized-Entities updated successfully',
      data: existingAefT5AuthorizedEntities,
    });
  } catch (error) {
    console.error('Error updating AEF-T5-Authorized-Entities:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteAefT5AuthorizedEntitiesV2 = async (req, res) => {
  try {
    const { cadTrustAefT5AuthorizedEntitiesId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!cadTrustAefT5AuthorizedEntitiesId.match(uuidRegex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AEF-T5-Authorized-Entities ID format',
      });
    }

    // Check if AEF-T5-Authorized-Entities exists
    const aefT5AuthorizedEntities = await AefT5AuthorizedEntitiesV2Mirror.findByPk(cadTrustAefT5AuthorizedEntitiesId);
    if (!aefT5AuthorizedEntities) {
      return res.status(404).json({
        success: false,
        message: 'AEF-T5-Authorized-Entities not found',
      });
    }

    // Delete AEF-T5-Authorized-Entities from staging table
    await aefT5AuthorizedEntities.destroy();

    res.status(200).json({
      success: true,
      message: 'AEF-T5-Authorized-Entities deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting AEF-T5-Authorized-Entities:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
