'use strict';

import { StakeholderProjectV2, StakeholderProjectV2Mirror, StakeholderV2, ProjectV2 } from '../../models/v2/index.js';
import { stakeholderProjectV2Schema } from '../../validations/v2/stakeholder-projects-v2.validations.js';
import { assertRecordExistanceOrStaged } from '../../utils/v2-data-assertions.js';
import { v4 as uuidv4 } from 'uuid';

export const createStakeholderProjectV2 = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = stakeholderProjectV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign keys: Both Stakeholder and Project must exist
    const stakeholderExists = await assertRecordExistanceOrStaged(
      StakeholderV2,
      value.cadTrustStakeholderId,
      'StakeholderV2 does not have a record'
    );
    if (!stakeholderExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['StakeholderV2 does not have a record'],
      });
    }

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

    // Check if the relationship already exists
    const existingRelation = await StakeholderProjectV2Mirror.findOne({
      where: {
        cadTrustStakeholderId: value.cadTrustStakeholderId,
        cadTrustProjectId: value.cadTrustProjectId,
      },
    });

    if (existingRelation) {
      return res.status(409).json({
        success: false,
        message: 'Stakeholder-Project relationship already exists',
        errors: ['This stakeholder-project combination already exists'],
      });
    }

    // Generate UUID for the stakeholder-project relationship
    const cadTrustStakeholderProjectId = uuidv4();

    // Create stakeholder-project relationship in staging table
    const stakeholderProject = await StakeholderProjectV2Mirror.create({
      cadTrustStakeholderProjectId,
      cadTrustStakeholderId: value.cadTrustStakeholderId,
      cadTrustProjectId: value.cadTrustProjectId,
    });

    res.status(201).json({
      success: true,
      message: 'Stakeholder-Project relationship created successfully',
      cadTrustStakeholderProjectId,
      data: stakeholderProject,
    });
  } catch (error) {
    console.error('Error creating stakeholder-project relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getStakeholderProjectV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stakeholder-project ID format',
      });
    }

    const stakeholderProject = await StakeholderProjectV2.findByPk(id, {
      include: [
        {
          model: StakeholderV2,
          as: 'stakeholder',
          attributes: ['cadTrustStakeholderId', 'stakeholderName', 'stakeholderType'],
        },
        {
          model: ProjectV2,
          as: 'project',
          attributes: ['cadTrustProjectId', 'projectName', 'projectRegistryName'],
        },
      ],
    });

    if (!stakeholderProject) {
      return res.status(404).json({
        success: false,
        message: 'Stakeholder-Project relationship not found',
      });
    }

    res.status(200).json({
      success: true,
      data: stakeholderProject,
    });
  } catch (error) {
    console.error('Error fetching stakeholder-project relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const getAllStakeholderProjectsV2 = async (req, res) => {
  try {
    const stakeholderProjects = await StakeholderProjectV2.findAll({
      include: [
        {
          model: StakeholderV2,
          as: 'stakeholder',
          attributes: ['cadTrustStakeholderId', 'stakeholderName', 'stakeholderType'],
        },
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
      data: stakeholderProjects,
      count: stakeholderProjects.length,
    });
  } catch (error) {
    console.error('Error fetching stakeholder-project relationships:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const updateStakeholderProjectV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stakeholder-project ID format',
      });
    }

    // Validate request body
    const { error, value } = stakeholderProjectV2Schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message),
      });
    }

    // Validate foreign keys: Both Stakeholder and Project must exist
    const stakeholderExists = await assertRecordExistanceOrStaged(
      StakeholderV2,
      value.cadTrustStakeholderId,
      'StakeholderV2 does not have a record'
    );
    if (!stakeholderExists) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key validation failed',
        errors: ['StakeholderV2 does not have a record'],
      });
    }

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

    // Check if stakeholder-project relationship exists
    const existingRelation = await StakeholderProjectV2Mirror.findByPk(id);
    if (!existingRelation) {
      return res.status(404).json({
        success: false,
        message: 'Stakeholder-Project relationship not found',
      });
    }

    // Check if the new combination would create a duplicate
    const duplicateCheck = await StakeholderProjectV2Mirror.findOne({
      where: {
        cadTrustStakeholderId: value.cadTrustStakeholderId,
        cadTrustProjectId: value.cadTrustProjectId,
        cadTrustStakeholderProjectId: { [require('sequelize').Op.ne]: id },
      },
    });

    if (duplicateCheck) {
      return res.status(409).json({
        success: false,
        message: 'Stakeholder-Project relationship already exists',
        errors: ['This stakeholder-project combination already exists'],
      });
    }

    // Update stakeholder-project relationship in staging table
    await existingRelation.update({
      cadTrustStakeholderId: value.cadTrustStakeholderId,
      cadTrustProjectId: value.cadTrustProjectId,
    });

    res.status(200).json({
      success: true,
      message: 'Stakeholder-Project relationship updated successfully',
      data: existingRelation,
    });
  } catch (error) {
    console.error('Error updating stakeholder-project relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

export const deleteStakeholderProjectV2 = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stakeholder-project ID format',
      });
    }

    // Check if stakeholder-project relationship exists
    const stakeholderProject = await StakeholderProjectV2Mirror.findByPk(id);
    if (!stakeholderProject) {
      return res.status(404).json({
        success: false,
        message: 'Stakeholder-Project relationship not found',
      });
    }

    // Delete stakeholder-project relationship from staging table
    await stakeholderProject.destroy();

    res.status(200).json({
      success: true,
      message: 'Stakeholder-Project relationship deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting stakeholder-project relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};
