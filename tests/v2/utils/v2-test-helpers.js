import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import datalayer from '../../../src/datalayer/index.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';

const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;

// V2-specific test utilities
export const waitForV2DataLayerSync = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, TEST_WAIT_TIME * 5);
  });
};

// V2 staging table utilities
export const resetV2StagingTable = async () => {
  const { StagingV2 } = await import('../../../src/models/v2/index.js');
  await StagingV2.destroy({ where: {} });
};

// V2 data table utilities
export const resetV2DataTables = async () => {
  const { UnitV2, IssuanceV2, VerificationV2, ValidationV2, ProjectV2, ProgramV2, MethodologyV2, LocationV2 } = await import('../../../src/models/v2/index.js');

  // Delete in reverse dependency order
  await UnitV2.destroy({ where: {} });
  await IssuanceV2.destroy({ where: {} });
  await VerificationV2.destroy({ where: {} });
  await ValidationV2.destroy({ where: {} });
  await LocationV2.destroy({ where: {} });
  await ProjectV2.destroy({ where: {} });
  await ProgramV2.destroy({ where: {} });
  await MethodologyV2.destroy({ where: {} });
};

// V2 organization utilities
export const createV2TestHomeOrg = async () => {
  const { OrganizationsV2 } = await import('../../../src/models/v2/index.js');

  // Create test home organization for V2
  const [org, created] = await OrganizationsV2.upsert({
    org_uid: 'test-home-org-v2',
    name: 'Test Home Organization V2',
    icon: 'test-icon',
    registry_id: 'test-registry-v2',
    registry_hash: 'test-hash-v2',
    subscribed: true,
    synced: true,
    file_store_subscribed: 'test-store-v2',
    sync_remaining: 0,
    balance: '0',
    pending_balance: '0',
    is_home: true,
    metadata: '{}',
    data_model_version_store_id: 'test-store-id-v2',
    data_model_version_store_hash: 'test-store-hash-v2',
  });

  return org;
};

export const getV2HomeOrgId = async () => {
  const { OrganizationsV2 } = await import('../../../src/models/v2/index.js');
  const homeOrg = await OrganizationsV2.findOne({
    where: { is_home: true },
    raw: true,
  });
  return homeOrg?.org_uid;
};

import { v4 as uuidv4 } from 'uuid';

// Helper to add UUID to model creation if needed
// Used for data tables that require UUID primary keys (not system tables)
export const addUuidIfNeeded = (modelName, data) => {

  const uuidFields = {
    ValidationV2: 'cadTrustValidationId',
    VerificationV2: 'cadTrustVerificationId',
    IssuanceV2: 'cadTrustIssuanceId',
    UnitV2: 'cadTrustUnitId',
    ProjectV2: 'cadTrustProjectId',
    LocationV2: 'cadTrustLocationId',
  };

  const uuidField = uuidFields[modelName];
  if (uuidField && !data[uuidField]) {
    data[uuidField] = uuidv4();
  }
  return data;
};

/**
 * Create a complete test program chain: Program → Project → Validation → Verification → Methodology → Issuance
 * This is a common pattern used in many tests for creating test dependencies.
 *
 * @param {Object} options - Optional configuration
 * @param {string} options.programName - Program name (default: 'Test Program')
 * @param {string} options.projectName - Project name (default: 'Test Project')
 * @param {string} options.projectId - Project ID (default: 'TEST-PROJECT-001')
 * @returns {Promise<Object>} Object containing all created records: { program, project, validation, verification, methodology, issuance }
 */
export const createV2TestProgramChain = async (options = {}) => {
  const {
    ProgramV2,
    ProjectV2,
    ValidationV2,
    VerificationV2,
    MethodologyV2,
    IssuanceV2,
  } = await import('../../../src/models/v2/index.js');

  const homeOrgId = await getV2HomeOrgId();

  const programName = options.programName || 'Test Program';
  const projectName = options.projectName || 'Test Project';
  const projectId = options.projectId || 'TEST-PROJECT-001';
  const testId = options.testId || '001';

  // Create program
  const program = await ProgramV2.create({
    programName: `${programName} ${testId}`,
    programRegistry: 'Test Registry',
    programRegistryActivityId: `TEST-ACT-${testId}`,
  });

  // Create project
  const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
    projectRegistryName: 'Test Registry',
    projectId: `${projectId}-${testId}`,
    projectName: `${projectName} ${testId}`,
    projectSector: options.projectSector || 'Agriculture',
    cadTrustProgramId: program.cadTrustProgramId,
    orgUid: homeOrgId,
    ...options.projectOverrides,
  }));

  // Create validation
  const validation = await ValidationV2.create(addUuidIfNeeded('ValidationV2', {
    validationId: `TEST-VALIDATION-${testId}`,
    validationType: 'Validation of Project Design Document',
    validationBody: 'AENOR International S.A.U.',
    cadTrustProjectId: project.cadTrustProjectId,
    ...options.validationOverrides,
  }));

  // Create verification
  const verification = await VerificationV2.create(addUuidIfNeeded('VerificationV2', {
    verificationId: `TEST-VERIFICATION-${testId}`,
    verificationBody: 'AENOR International S.A.U.',
    cadTrustProjectId: project.cadTrustProjectId,
    cadTrustValidationId: validation.cadTrustValidationId,
    ...options.verificationOverrides,
  }));

  // Create methodology
  const methodology = await MethodologyV2.create({
    methodologyCode: `TEST-METHODOLOGY-${testId}`,
    methodologyName: `Test Methodology ${testId}`,
    methodologyType: 'Methodology for Afforestation and Reforestation',
    ...options.methodologyOverrides,
  });

  // Create issuance
  const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
    issuanceId: `TEST-ISSUANCE-${testId}`,
    issuanceDate: options.issuanceDate || '2024-01-01',
    cadTrustVerificationId: verification.cadTrustVerificationId,
    cadTrustMethodologyId: methodology.cadTrustMethodologyId,
    ...options.issuanceOverrides,
  }));

  return {
    program,
    project,
    validation,
    verification,
    methodology,
    issuance,
  };
};

/**
 * Create a test project chain: Program → Project
 *
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Object containing created records: { program, project }
 */
export const createV2TestProjectChain = async (options = {}) => {
  const { ProgramV2, ProjectV2 } = await import('../../../src/models/v2/index.js');

  const homeOrgId = await getV2HomeOrgId();
  const testId = options.testId || '001';

  // Create program
  const program = await ProgramV2.create({
    programName: options.programName || `Test Program ${testId}`,
    programRegistry: 'Test Registry',
    programRegistryActivityId: `TEST-ACT-${testId}`,
  });

  // Create project
  const project = await ProjectV2.create(addUuidIfNeeded('ProjectV2', {
    projectRegistryName: 'Test Registry',
    projectId: options.projectId || `TEST-PROJECT-${testId}`,
    projectName: options.projectName || `Test Project ${testId}`,
    projectSector: options.projectSector || 'Agriculture',
    cadTrustProgramId: program.cadTrustProgramId,
    orgUid: homeOrgId,
    ...options.projectOverrides,
  }));

  return { program, project };
};

// V2 test data generators
export const createV2TestProject = async () => {
  const { v4: uuidv4 } = await import('uuid');
  const homeOrgId = await getV2HomeOrgId();

  return {
    cad_trust_project_id: uuidv4(),
    org_uid: homeOrgId || 'test-home-org-v2', // Use home org UID if available, fallback to test org
    project_registry_name: 'Test Registry V2',
    project_id: 'TEST-PROJECT-V2',
    project_crediting_program: 'Test Program V2',
    project_name: 'Test Project V2',
    project_link: 'https://test-project-v2.example.com',
    project_description: 'Test project description for V2',
    project_sector: 'Agriculture; forestry and fishing',
    project_type: 'Forestry',
    project_subtype: 'Test Subtype',
    project_status: 'Registered',
    project_status_date: '2024-01-01',
    project_unit_metric: 'tCO2e',
    cad_trust_reference_project_id: 'TEST-REF-V2',
    cad_trust_program_id: uuidv4(),
  };
};

// V2 validation utilities
export const validateV2RecordStructure = (record, expectedFields) => {
  expectedFields.forEach(field => {
    expect(record).to.have.property(field);
  });
};

export const validateV2TimestampFields = (record) => {
  expect(record).to.have.property('created_at');
  expect(record).to.have.property('updated_at');
  expect(record.created_at).to.be.a('string');
  expect(record.updated_at).to.be.a('string');
};

// V2 API test utilities
export const makeV2ApiRequest = async (method, endpoint, data = null) => {
  const supertest = (await import('supertest')).default;
  const app = (await import('../../../src/server.js')).default;

  let request = supertest(app)[method.toLowerCase()](`/v2${endpoint}`);

  if (data) {
    request = request.send(data);
  }

  return request;
};

// V2 database utilities
export const getV2TableCount = async (tableName) => {
  const { sequelizeV2 } = await import('../../../src/database/v2/index.js');
  const result = await sequelizeV2.query(
    `SELECT COUNT(*) as count FROM ${tableName}`,
    { type: sequelizeV2.QueryTypes.SELECT }
  );
  return result[0].count;
};

export const getV2TableSchema = async (tableName) => {
  const { sequelizeV2 } = await import('../../../src/database/v2/index.js');
  const result = await sequelizeV2.query(
    `PRAGMA table_info(${tableName})`,
    { type: sequelizeV2.QueryTypes.SELECT }
  );
  return result;
};

/**
 * Helper to temporarily override config values for testing
 * Clears the memoize cache, modifies config file, runs test, then restores
 *
 * @param {Function} testFn - The test function to run with overridden config
 * @param {Object} configOverrides - Config values to override (e.g., { APP: { IS_GOVERNANCE_BODY: true } })
 * @returns {Promise} Result of testFn
 */
export const withConfigOverride = async (testFn, configOverrides) => {
  const chiaRoot = getChiaRoot();
  const unifiedConfigFile = path.resolve(`${chiaRoot}/cadt/config.yaml`);

  // Ensure directory exists
  const configDir = path.dirname(unifiedConfigFile);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Read current unified config
  let originalConfig = null;
  if (fs.existsSync(unifiedConfigFile)) {
    originalConfig = yaml.load(fs.readFileSync(unifiedConfigFile, 'utf8'));
  } else {
    // If unified config doesn't exist, use default structure
    originalConfig = {
      APP: {},
      V1: {},
      V2: {},
    };
  }

  try {
    // Clear memoize cache
    if (getConfig.cache) {
      getConfig.cache.clear();
    }
    if (getConfigV2.cache) {
      getConfigV2.cache.clear();
    }
    if (getChiaRoot.cache) {
      getChiaRoot.cache.clear();
    }

    // Load current unified config structure (or use defaults)
    const currentConfig = originalConfig ? JSON.parse(JSON.stringify(originalConfig)) : {
      APP: {},
      V1: {},
      V2: {},
    };

    // Merge overrides into appropriate sections
    Object.keys(configOverrides).forEach(section => {
      if (['V1', 'V2'].includes(section)) {
        // Direct V1/V2 section overrides
        if (!currentConfig[section]) {
          currentConfig[section] = {};
        }
        Object.assign(currentConfig[section], configOverrides[section]);
      } else if (section === 'APP') {
        // APP section - merge into unified APP section (shared config)
        // But some fields belong in V1/V2 sections, not APP
        const v1V2Fields = ['IS_GOVERNANCE_BODY', 'READ_ONLY', 'CADT_API_KEY', 'ENABLE'];

        if (!currentConfig.APP) {
          currentConfig.APP = {};
        }
        if (!currentConfig.V1) {
          currentConfig.V1 = {};
        }
        if (!currentConfig.V2) {
          currentConfig.V2 = {};
        }

        // Separate APP fields from V1/V2 fields
        Object.keys(configOverrides.APP).forEach(key => {
          if (v1V2Fields.includes(key)) {
            // These belong in V1/V2 sections
            currentConfig.V1[key] = configOverrides.APP[key];
            currentConfig.V2[key] = configOverrides.APP[key];
          } else {
            // These belong in APP section
            currentConfig.APP[key] = configOverrides.APP[key];
          }
        });
      } else {
        // Legacy support: if override keys don't match sections, merge into V1
        // This handles old-style overrides like { GOVERNANCE: { ... }, MIRROR_DB: { ... } }
        // These are V1-specific sections
        if (!currentConfig.V1[section]) {
          currentConfig.V1[section] = {};
        }
        if (typeof configOverrides[section] === 'object' && !Array.isArray(configOverrides[section])) {
          Object.assign(currentConfig.V1[section], configOverrides[section]);
        } else {
          currentConfig.V1[section] = configOverrides[section];
        }
      }
    });

    // Write modified unified config
    fs.writeFileSync(unifiedConfigFile, yaml.dump(currentConfig), 'utf8');

    // Clear cache again to force reload
    if (getConfig.cache) {
      getConfig.cache.clear();
    }
    if (getConfigV2.cache) {
      getConfigV2.cache.clear();
    }
    if (getChiaRoot.cache) {
      getChiaRoot.cache.clear();
    }

    // Run the test
    return await testFn();
  } finally {
    // Restore original config
    if (originalConfig && Object.keys(originalConfig).length > 0) {
      fs.writeFileSync(unifiedConfigFile, yaml.dump(originalConfig), 'utf8');
    } else if (fs.existsSync(unifiedConfigFile)) {
      // If there was no original, remove the test config
      fs.unlinkSync(unifiedConfigFile);
    }

    // Clear cache to reload original config
    if (getConfig.cache) {
      getConfig.cache.clear();
    }
    if (getConfigV2.cache) {
      getConfigV2.cache.clear();
    }
    if (getChiaRoot.cache) {
      getChiaRoot.cache.clear();
    }
  }
};
