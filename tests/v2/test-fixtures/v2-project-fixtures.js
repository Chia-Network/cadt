import { expect } from 'chai';
import { ProjectV2, ValidationV2, VerificationV2, IssuanceV2, UnitV2 } from '../../../src/models/v2/index.js';
import { StagingV2 } from '../../../src/models/v2/index.js';

// V2 project-specific fixtures
export const createV2TestProject = async (projectData) => {
  const project = await ProjectV2.create(projectData);
  return project;
};

export const createV2TestProjectWithChildren = async (projectData, childrenData = {}) => {
  const project = await ProjectV2.create(projectData);

  if (childrenData.validations) {
    for (const validationData of childrenData.validations) {
      await ValidationV2.create({
        ...validationData,
        cadTrustProjectId: project.cadTrustProjectId,
      });
    }
  }

  if (childrenData.verifications) {
    for (const verificationData of childrenData.verifications) {
      await VerificationV2.create({
        ...verificationData,
        cadTrustProjectId: project.cadTrustProjectId,
      });
    }
  }

  if (childrenData.issuances) {
    for (const issuanceData of childrenData.issuances) {
      await IssuanceV2.create({
        ...issuanceData,
        cadTrustProjectId: project.cadTrustProjectId,
      });
    }
  }

  if (childrenData.units) {
    for (const unitData of childrenData.units) {
      await UnitV2.create({
        ...unitData,
        cadTrustProjectId: project.cadTrustProjectId,
      });
    }
  }

  return project;
};

export const validateV2ProjectStructure = (project) => {
  const requiredFields = [
    'cadTrustProjectId',
    'projectRegistryName',
    'projectId',
    'projectName',
    'projectSector',
    'projectType',
    'projectStatus',
    'projectUnitMetric',
    'created_at',
    'updated_at',
  ];

  requiredFields.forEach(field => {
    expect(project).to.have.property(field);
  });
};

export const validateV2ProjectRelationships = async (projectId) => {
  const validations = await ValidationV2.findAll({
    where: { cadTrustProjectId: projectId },
  });

  const verifications = await VerificationV2.findAll({
    where: { cadTrustProjectId: projectId },
  });

  const issuances = await IssuanceV2.findAll({
    where: { cadTrustProjectId: projectId },
  });

  const units = await UnitV2.findAll({
    where: { cadTrustProjectId: projectId },
  });

  return {
    validations,
    verifications,
    issuances,
    units,
  };
};

// V2 staging project fixtures
export const stageV2Project = async (projectData) => {
  const stagingData = {
    uuid: `v2-test-uuid-${Date.now()}`,
    table: 'project',
    action: 'INSERT',
    data: JSON.stringify([projectData]),
    commited: false,
    failedCommit: false,
    isTransfer: false,
  };

  return await StagingV2.create(stagingData);
};

export const validateV2StagedProject = async (stagingUuid) => {
  const stagingRecord = await StagingV2.findOne({
    where: { uuid: stagingUuid },
    raw: true,
  });

  expect(stagingRecord).to.be.ok;
  expect(stagingRecord.table).to.equal('project');
  expect(stagingRecord.action).to.equal('INSERT');

  const projectData = JSON.parse(stagingRecord.data);
  expect(projectData).to.be.an('array');
  expect(projectData).to.have.length(1);

  return projectData[0];
};

// V2 project update fixtures
export const updateV2Project = async (projectId, updateData) => {
  const stagingData = {
    uuid: `v2-test-update-uuid-${Date.now()}`,
    table: 'project',
    action: 'UPDATE',
    data: JSON.stringify([{ cadTrustProjectId: projectId, ...updateData }]),
    commited: false,
    failedCommit: false,
    isTransfer: false,
  };

  return await StagingV2.create(stagingData);
};

// V2 project delete fixtures
export const deleteV2Project = async (projectId) => {
  const stagingData = {
    uuid: `v2-test-delete-uuid-${Date.now()}`,
    table: 'project',
    action: 'DELETE',
    data: JSON.stringify([{ cadTrustProjectId: projectId }]),
    commited: false,
    failedCommit: false,
    isTransfer: false,
  };

  return await StagingV2.create(stagingData);
};

// V2 project validation fixtures
export const validateV2ProjectPicklists = (project) => {
  const validSectors = ['Energy', 'Transport', 'Agriculture', 'Forestry', 'Waste'];
  const validTypes = ['Renewable Energy', 'Energy Efficiency', 'Forest Conservation'];
  const validStatuses = ['Registered', 'Under Validation', 'Validated', 'Under Verification'];
  const validMetrics = ['tCO2e', 'tCO2', 'tCH4', 'tN2O'];

  if (project.projectSector) {
    expect(validSectors).to.include(project.projectSector);
  }

  if (project.projectType) {
    expect(validTypes).to.include(project.projectType);
  }

  if (project.projectStatus) {
    expect(validStatuses).to.include(project.projectStatus);
  }

  if (project.projectUnitMetric) {
    expect(validMetrics).to.include(project.projectUnitMetric);
  }
};

// V2 project search fixtures
export const searchV2Projects = async (searchCriteria) => {
  const where = {};

  if (searchCriteria.projectName) {
    where.projectName = { [require('sequelize').Op.like]: `%${searchCriteria.projectName}%` };
  }

  if (searchCriteria.projectSector) {
    where.projectSector = searchCriteria.projectSector;
  }

  if (searchCriteria.projectStatus) {
    where.projectStatus = searchCriteria.projectStatus;
  }

  return await ProjectV2.findAll({ where });
};

// V2 project pagination fixtures
export const paginateV2Projects = async (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const { count, rows } = await ProjectV2.findAndCountAll({
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return {
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};
