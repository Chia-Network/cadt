import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import datalayer from '../../../src/datalayer/index.js';
import { getConfig, getConfigV2 } from '../../../src/utils/config-loader.js';
import { getChiaRoot } from '../../../src/utils/chia-root.js';

const USE_SIMULATOR = process.env.USE_SIMULATOR === 'true';
const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;

// V2-specific test utilities
export const waitForV2DataLayerSync = () => {
  return new Promise((resolve) => {
    // In simulator mode, data syncs instantly - no need for long waits
    // Real datalayer mode still uses the full 50-second wait for blockchain confirmations
    const waitTime = USE_SIMULATOR ? 500 : TEST_WAIT_TIME * 5;
    setTimeout(() => {
      resolve();
    }, waitTime);
  });
};

/**
 * Commit V2 staging records and wait for sync to complete
 *
 * In simulator mode: Uses a short 500ms wait (data syncs instantly)
 * In real datalayer mode: Uses 50-second fixed delay for blockchain confirmations
 *
 * The wait allows time for the scheduler to:
 * - Run truncateStaging to clean up committed records
 * - Sync data from simulator to main tables
 * - Complete all background processing
 *
 * @returns {Promise<Object>} Response from commit API
 */
export const commitV2StagingAndWait = async () => {
  const supertest = (await import('supertest')).default;
  const app = (await import('../../../src/server.js')).default;
  const { StagingV2 } = await import('../../../src/models/v2/index.js');

  // Count uncommitted staging records before commit
  const preCommitCount = await StagingV2.count({ where: { committed: false } });
  console.log(`[TEST commitV2StagingAndWait] BEFORE COMMIT: ${preCommitCount} uncommitted staging records`);

  // Commit the staging records
  const commitTime = Date.now();
  const response = await supertest(app).post('/v2/staging/commit');
  console.log(`[TEST commitV2StagingAndWait] COMMIT API called at ${new Date(commitTime).toISOString()}, status: ${response.status}`);

  // Count staging records immediately after commit
  const postCommitCount = await StagingV2.count({ where: { committed: false } });
  const committedCount = await StagingV2.count({ where: { committed: true } });
  console.log(`[TEST commitV2StagingAndWait] IMMEDIATELY AFTER COMMIT: ${postCommitCount} uncommitted, ${committedCount} committed`);

  // Wait for sync - in simulator mode this is 500ms, in real mode it's 50 seconds
  const waitDescription = USE_SIMULATOR ? '500ms (simulator mode)' : '50 seconds (real datalayer)';
  console.log(`[TEST commitV2StagingAndWait] Starting ${waitDescription} wait for sync...`);
  await waitForV2DataLayerSync();

  // Check staging state after wait
  const finalUncommittedCount = await StagingV2.count({ where: { committed: false } });
  const finalCommittedCount = await StagingV2.count({ where: { committed: true } });
  const finalTotalCount = await StagingV2.count();
  console.log(`[TEST commitV2StagingAndWait] AFTER 50s WAIT: ${finalUncommittedCount} uncommitted, ${finalCommittedCount} committed, ${finalTotalCount} total`);

  const elapsedTime = Date.now() - commitTime;
  console.log(`[TEST commitV2StagingAndWait] Total elapsed time: ${elapsedTime}ms (${(elapsedTime/1000).toFixed(1)}s)`);

  return response;
};

/**
 * Commit V2 staging records and poll until condition is met
 * Uses smart polling to pass as soon as sync completes, with configurable timeout
 *
 * In simulator mode: Uses 500ms intervals (10 attempts = 5s total)
 * In real datalayer mode: Uses 5s intervals (10 attempts = 50s total)
 *
 * @param {Function} checkFn - Async function that returns true when sync is complete
 *                             Example: async () => (await UnitV2.findByPk(unitId))?.marketplace === 'expected'
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Time between checks in ms (default: 500ms simulator, 5000ms real)
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 10)
 * @param {string} options.description - Description for error/log messages (default: "Sync operation")
 * @returns {Promise<Object>} Response from commit API
 * @throws {Error} If condition not met within timeout
 *
 * @example
 * await commitV2StagingAndWaitForCondition(
 *   async () => {
 *     const unit = await UnitV2.findOne({ where: { cadTrustUnitId: unitId }});
 *     return unit?.marketplace === 'Climate Marketplace';
 *   },
 *   { description: 'Unit marketplace update sync' }
 * );
 */
export const commitV2StagingAndWaitForCondition = async (checkFn, options = {}) => {
  const supertest = (await import('supertest')).default;
  const app = (await import('../../../src/server.js')).default;
  const { StagingV2 } = await import('../../../src/models/v2/index.js');

  // In simulator mode, use shorter intervals since data syncs instantly
  const defaultInterval = USE_SIMULATOR ? 500 : 5000;
  const interval = options.interval || defaultInterval;
  const maxAttempts = options.maxAttempts || 10;
  const description = options.description || 'Sync operation';

  // Count uncommitted staging records before commit
  const preCommitCount = await StagingV2.count({ where: { committed: false } });
  console.log(`[TEST commitV2StagingAndWaitForCondition] BEFORE COMMIT: ${preCommitCount} uncommitted staging records`);

  // Commit the staging records
  const commitTime = Date.now();
  const response = await supertest(app).post('/v2/staging/commit');
  console.log(`[TEST commitV2StagingAndWaitForCondition] COMMIT API called at ${new Date(commitTime).toISOString()}, status: ${response.status}, description: "${description}"`);

  // Wait 5 seconds before first check (give scheduler time to start processing)
  console.log(`[TEST commitV2StagingAndWaitForCondition] Waiting 5s before first check...`);
  await new Promise(resolve => setTimeout(resolve, interval));

  // Poll until checkFn returns true or we hit maxAttempts
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[TEST commitV2StagingAndWaitForCondition] Attempt ${attempt}/${maxAttempts}: Checking condition for "${description}"...`);

    try {
      const isComplete = await checkFn();

      if (isComplete) {
        const elapsedTime = Date.now() - commitTime;
        console.log(`[TEST commitV2StagingAndWaitForCondition] ✓ SUCCESS after ${elapsedTime}ms (${(elapsedTime/1000).toFixed(1)}s, ${attempt} attempts) - ${description}`);
        return response;
      }

      console.log(`[TEST commitV2StagingAndWaitForCondition] Condition not met yet, waiting ${interval/1000}s before next attempt...`);

      // Not complete yet, wait before next attempt (unless this was the last attempt)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (checkError) {
      console.log(`[TEST commitV2StagingAndWaitForCondition] Check function threw error on attempt ${attempt}: ${checkError.message}`);
      // Continue polling even if check throws - the data might not be there yet
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  // Timeout reached
  const elapsedTime = Date.now() - commitTime;
  const errorMessage = `${description} did not complete within ${maxAttempts * interval / 1000} seconds (${maxAttempts} attempts at ${interval / 1000}s intervals). Total elapsed: ${elapsedTime}ms`;
  console.log(`[TEST commitV2StagingAndWaitForCondition] ✗ TIMEOUT - ${errorMessage}`);
  throw new Error(errorMessage);
};

/**
 * Safety check: Verify that test databases are being used
 * This prevents accidental production database access during tests
 * Should be called at the start of test suites
 */
export const verifyTestDatabaseConfiguration = async () => {
  // Verify NODE_ENV is set to 'test'
  if (process.env.NODE_ENV !== 'test') {
    const errorMsg = `SAFETY CHECK FAILED: NODE_ENV is not set to 'test' (current value: '${process.env.NODE_ENV || 'undefined'}'). Tests must run with NODE_ENV=test to prevent accidental production database access. Always use npm test or npm run test:v2 commands.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Verify V1 database configuration (if V1 is enabled)
  try {
    const { sequelize } = await import('../../../src/database/index.js');
    const v1Storage = sequelize.options.storage;
    if (v1Storage) {
      // Check that it's a test database under tests/test-dbs/
      if (!v1Storage.includes('tests/test-dbs/') || !v1Storage.includes('.sqlite3')) {
        const errorMsg = `SAFETY CHECK FAILED: V1 database storage path '${v1Storage}' does not appear to be a test database. Expected path under tests/test-dbs/. This prevents accidental production database access.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      // Check that it's not in home directory
      if (v1Storage.includes('~') || v1Storage.includes('/.chia/') || v1Storage.includes(os.homedir())) {
        const errorMsg = `SAFETY CHECK FAILED: V1 database storage path '${v1Storage}' appears to be in home directory. Test databases must be under tests/test-dbs/. This prevents accidental production database access.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  } catch (err) {
    // If V1 database isn't initialized, that's okay - we're focusing on V2 tests
    if (!err.message.includes('SAFETY CHECK FAILED')) {
      // Ignore other errors (V1 might not be enabled)
    } else {
      throw err;
    }
  }

  // Verify V2 database configuration
  const { sequelizeV2 } = await import('../../../src/database/v2/index.js');
  const v2Storage = sequelizeV2.options.storage;
  if (!v2Storage || !v2Storage.includes('tests/test-dbs/') || !v2Storage.includes('.sqlite3')) {
    const errorMsg = `SAFETY CHECK FAILED: V2 database storage path '${v2Storage}' does not appear to be a test database. Expected path under tests/test-dbs/. This prevents accidental production database access.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  if (v2Storage.includes('~') || v2Storage.includes('/.chia/') || v2Storage.includes(os.homedir())) {
    const errorMsg = `SAFETY CHECK FAILED: V2 database storage path '${v2Storage}' appears to be in home directory. Test databases must be under tests/test-dbs/. This prevents accidental production database access.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
};

// Scheduler control — pause background tasks to prevent mutex contention
// during CRUD-only test suites that don't need the sync loop.
export const pauseSchedulerTasks = async () => {
  const scheduler = (await import('../../../src/tasks/index.js')).default;
  scheduler.pauseAll();

  // Wait for any in-flight handler to finish and release its mutexes
  const { syncRegistriesTaskMutexV2, processingSyncRegistriesTransactionMutexV2 } =
    await import('../../../src/utils/v2-mutex-utils.js');
  if (syncRegistriesTaskMutexV2.isLocked()) {
    await syncRegistriesTaskMutexV2.waitForUnlock();
  }
  if (processingSyncRegistriesTransactionMutexV2.isLocked()) {
    await processingSyncRegistriesTransactionMutexV2.waitForUnlock();
  }
};

export const resumeSchedulerTasks = async () => {
  const scheduler = (await import('../../../src/tasks/index.js')).default;
  scheduler.resumeAll();
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

  // Optimization: Check if our test home org already exists with correct configuration
  // This avoids unnecessary DB writes in most test runs
  const existingHomeOrg = await OrganizationsV2.findOne({
    where: {
      org_uid: 'test-home-org-v2',
      is_home: true,
      subscribed: true,
    },
  });

  if (existingHomeOrg) {
    // Also verify no OTHER orgs have is_home: true (could cause findOne issues)
    const otherHomeOrgs = await OrganizationsV2.count({
      where: {
        is_home: true,
        org_uid: { [OrganizationsV2.sequelize.Sequelize.Op.ne]: 'test-home-org-v2' },
      },
    });

    if (otherHomeOrgs === 0) {
      // Perfect state - our home org exists and is the only one
      return existingHomeOrg;
    }
  }

  // Need to fix state: clear any existing home orgs to ensure only one exists
  // This prevents test interference where other tests create orgs with is_home: true
  // and findOne({ where: { is_home: true } }) might find the wrong one
  await OrganizationsV2.update(
    { is_home: false },
    { where: { is_home: true } }
  );

  // Create/update test home organization for V2
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
    ProjectMethodologyV2: 'cadTrustProjectMethodologyId',
  };

  const uuidField = uuidFields[modelName];
  if (uuidField && !data[uuidField]) {
    data[uuidField] = uuidv4();
  }
  return data;
};

/**
 * Create a complete test program chain: Program → Project → Validation → Verification → Methodology → ProjectMethodology → Issuance
 * This is a common pattern used in many tests for creating test dependencies.
 *
 * @param {Object} options - Optional configuration
 * @param {string} options.programName - Program name (default: 'Test Program')
 * @param {string} options.projectName - Project name (default: 'Test Project')
 * @param {string} options.projectId - Project ID (default: 'TEST-PROJECT-001')
 * @returns {Promise<Object>} Object containing all created records: { program, project, validation, verification, methodology, projectMethodology, issuance }
 */
export const createV2TestProgramChain = async (options = {}) => {
  const {
    ProgramV2,
    ProjectV2,
    ValidationV2,
    VerificationV2,
    MethodologyV2,
    ProjectMethodologyV2,
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
    projectSector: options.projectSector || ['Agriculture'],
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

  // Create project-methodology join record (links project to methodology)
  const projectMethodology = await ProjectMethodologyV2.create(addUuidIfNeeded('ProjectMethodologyV2', {
    cadTrustProjectId: project.cadTrustProjectId,
    cadTrustMethodologyId: methodology.cadTrustMethodologyId,
    projectMethodologyDate: '2024-01-01',
    projectMethodologyDescription: `Test Project Methodology ${testId}`,
    ...options.projectMethodologyOverrides,
  }));

  // Create issuance (references ProjectMethodology, not Methodology directly)
  const issuance = await IssuanceV2.create(addUuidIfNeeded('IssuanceV2', {
    issuanceId: `TEST-ISSUANCE-${testId}`,
    issuanceDate: options.issuanceDate || '2024-01-01',
    cadTrustVerificationId: verification.cadTrustVerificationId,
    cadTrustProjectMethodologyId: projectMethodology.cadTrustProjectMethodologyId,
    ...options.issuanceOverrides,
  }));

  return {
    program,
    project,
    validation,
    verification,
    methodology,
    projectMethodology,
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
    projectSector: options.projectSector || ['Agriculture'],
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
 * Clears the memoize cache, modifies test config file, runs test, then restores
 * Uses test-specific config file (tests/v2/config/test-config.yaml) instead of production config
 *
 * @param {Function} testFn - The test function to run with overridden config
 * @param {Object} configOverrides - Config values to override (e.g., { APP: { IS_GOVERNANCE_BODY: true } })
 * @returns {Promise} Result of testFn
 */
export const withConfigOverride = async (testFn, configOverrides) => {
  // Use test-specific config file when running tests
  const projectRoot = path.resolve(process.cwd());
  const unifiedConfigDir = path.resolve(`${projectRoot}/tests/v2/config`);
  const unifiedConfigFile = path.resolve(`${unifiedConfigDir}/test-config.yaml`);

  // Ensure directory exists
  if (!fs.existsSync(unifiedConfigDir)) {
    fs.mkdirSync(unifiedConfigDir, { recursive: true });
  }

  // Read current unified config
  let originalConfig = null;
  if (fs.existsSync(unifiedConfigFile)) {
    originalConfig = yaml.load(fs.readFileSync(unifiedConfigFile, 'utf8'));
  } else {
    // If test config doesn't exist, use default config structure
    const { defaultConfig } = await import('../../../src/utils/defaultConfig.js');
    originalConfig = JSON.parse(JSON.stringify(defaultConfig));
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
    let currentConfig;
    if (originalConfig) {
      currentConfig = JSON.parse(JSON.stringify(originalConfig));
    } else {
      // Fallback to default config if originalConfig is null
      const { defaultConfig } = await import('../../../src/utils/defaultConfig.js');
      currentConfig = JSON.parse(JSON.stringify(defaultConfig));
    }

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
        if (!currentConfig.V1) {
          currentConfig.V1 = {};
        }
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

/**
 * Commit V2 staging records
 * @returns {Promise<Object>} Response from commit API
 */
export const commitV2Staging = async () => {
  const supertest = (await import('supertest')).default;
  const app = (await import('../../../src/server.js')).default;
  await supertest(app).post('/v2/staging/commit');
};

/**
 * Wait for V2 sync to complete by polling
 *
 * Smart polling with early exit:
 * - In simulator mode: Uses shorter intervals (500ms default, 10 attempts = 5s total)
 * - In real datalayer mode: Uses longer intervals (5s default, 10 attempts = 50s total)
 * - Waits FIRST, then checks (gives scheduler time to run)
 * - Exits early when checkFn returns true
 *
 * @param {Function} checkFn - Function that returns true when sync is complete (e.g., () => record exists)
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Time between checks in ms (default: 500ms simulator, 5000ms real)
 * @param {number} options.maxAttempts - Maximum number of attempts (default: 10)
 * @param {string} options.description - Description for error message (default: "Sync operation")
 * @returns {Promise<void>}
 * @throws {Error} If sync doesn't complete within maxAttempts
 */
export const waitForV2Sync = async (checkFn = null, options = {}) => {
  // In simulator mode, use shorter intervals since data syncs instantly
  const defaultInterval = USE_SIMULATOR ? 500 : 5000;
  const interval = options.interval || defaultInterval;
  const maxAttempts = options.maxAttempts || 10;
  const description = options.description || 'Sync operation';

  // If no checkFn provided, just wait for the full duration (backward compatibility with V1 pattern)
  if (!checkFn) {
    const delay = interval * maxAttempts; // Default: 50 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
    return;
  }

  // Poll until checkFn returns true or we hit maxAttempts
  // IMPORTANT: Wait FIRST, then check (gives scheduler time to process)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Wait before checking (scheduler runs every 5s, so give it time)
    await new Promise(resolve => setTimeout(resolve, interval));

    // Check if sync is complete
    const isComplete = await checkFn();
    if (isComplete) {
      return; // Success! Exit early
    }

    // Not complete yet, continue polling (unless we're at maxAttempts)
    if (attempt >= maxAttempts) {
      // Final attempt exhausted, throw error
      throw new Error(
        `${description} did not complete within ${maxAttempts * interval / 1000} seconds (${maxAttempts} attempts at ${interval / 1000}s intervals)`
      );
    }
  }
};

