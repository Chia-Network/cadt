'use strict';

import { ProjectMethodologyV2, ProjectMethodologyV2Mirror, ProjectV2, MethodologyV2 } from '../../models/v2/index.js';
import { projectMethodologyV2Schema } from '../../validations/v2/project-methodology-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';

export const createProjectMethodologyV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = projectMethodologyV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign keys: Both Project and Methodology must exist
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

    const methodologyExists = await assertRecordExistanceOrStaged(
      MethodologyV2,
      value.cadTrustMethodologyId,
      'MethodologyV2 does not have a record'
    );
    if (!methodologyExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['MethodologyV2 does not have a record'],
      });
    }

    // Check if the relationship already exists
    const existingRelation = await ProjectMethodologyV2Mirror.findOne({
      where: {
        cadTrustProjectId: value.cadTrustProjectId,
        cadTrustMethodologyId: value.cadTrustMethodologyId,
      },
    });

    if (existingRelation) {
      return res.status(409).json({
        success: false,
        message: 'Project-Methodology relationship already exists',
        errors: ['This project-methodology combination already exists'],
      });
    }

    // Create project-methodology relationship in staging table
    const projectMethodology = await ProjectMethodologyV2Mirror.create({
      cadTrustProjectId: value.cadTrustProjectId,
      cadTrustMethodologyId: value.cadTrustMethodologyId,
      projectMethodologyDate: value.projectMethodologyDate,
      projectMethodologyDescription: value.projectMethodologyDescription,
    });

    res.status(201).json({
      success: true,
      message: 'Project-Methodology relationship created successfully',
      data: projectMethodology,
    });
  } catch (error) {
    console.error('Error creating project-methodology relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getProjectMethodologyV2 = async (req, res) => {
  try {
    const { projectId, methodologyId } = req.params;

    // Validate UUID formats
    if (!projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format',
      });
    }

    if (!methodologyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid methodology ID format',
      });
    }

    const projectMethodology = await ProjectMethodologyV2.findOne({
      where: {
        cadTrustProjectId: projectId,
        cadTrustMethodologyId: methodologyId,
      },
      include: [
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
        },
        {
          model: MethodologyV2,
          as: 'methodology',
          attributes: ['cadTrustMethodologyId', 'methodologyName', 'methodologyCode'],
        },
      ],
    });

    if (!projectMethodology) {
      return res.status(404).json({
        success: false,
        message: 'Project-Methodology relationship not found',
      });
    }

    res.status(200).json({
      success: true,
      data: projectMethodology,
    });
  } catch (error) {
    console.error('Error fetching project-methodology relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllProjectMethodologiesV2 = async (req, res) => {
  try {
    const projectMethodologies = await ProjectMethodologyV2.findAll({
      include: [
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
        },
        {
          model: MethodologyV2,
          as: 'methodology',
          attributes: ['cadTrustMethodologyId', 'methodologyName', 'methodologyCode'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: projectMethodologies,
      count: projectMethodologies.length,
    });
  } catch (error) {
    console.error('Error fetching project-methodology relationships:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateProjectMethodologyV2 = async (req, res) => {
  try {
    const { projectId, methodologyId } = req.params;

    // Validate UUID formats
    if (!projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format',
      });
    }

    if (!methodologyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid methodology ID format',
      });
    }

    // Validate request body
    const { error, value } = projectMethodologyV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign keys: Both Project and Methodology must exist
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

    const methodologyExists = await assertRecordExistanceOrStaged(
      MethodologyV2,
      value.cadTrustMethodologyId,
      'MethodologyV2 does not have a record'
    );
    if (!methodologyExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['MethodologyV2 does not have a record'],
      });
    }

    // Check if project-methodology relationship exists
    const existingRelation = await ProjectMethodologyV2Mirror.findOne({
      where: {
        cadTrustProjectId: projectId,
        cadTrustMethodologyId: methodologyId,
      },
    });

    if (!existingRelation) {
      return res.status(404).json({
        success: false,
        message: 'Project-Methodology relationship not found',
      });
    }

    // Update project-methodology relationship in staging table
    await existingRelation.update({
      projectMethodologyDate: value.projectMethodologyDate,
      projectMethodologyDescription: value.projectMethodologyDescription,
    });

    res.status(200).json({
      success: true,
      message: 'Project-Methodology relationship updated successfully',
      data: existingRelation,
    });
  } catch (error) {
    console.error('Error updating project-methodology relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteProjectMethodologyV2 = async (req, res) => {
  try {
    const { projectId, methodologyId } = req.params;

    // Validate UUID formats
    if (!projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format',
      });
    }

    if (!methodologyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid methodology ID format',
      });
    }

    // Check if project-methodology relationship exists
    const projectMethodology = await ProjectMethodologyV2Mirror.findOne({
      where: {
        cadTrustProjectId: projectId,
        cadTrustMethodologyId: methodologyId,
      },
    });

    if (!projectMethodology) {
      return res.status(404).json({
        success: false,
        message: 'Project-Methodology relationship not found',
      });
    }

    // Delete project-methodology relationship from staging table
    await projectMethodology.destroy();

    res.status(200).json({
      success: true,
      message: 'Project-Methodology relationship deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project-methodology relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
