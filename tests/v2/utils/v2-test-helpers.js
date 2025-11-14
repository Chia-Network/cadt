import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import datalayer from '../../../src/datalayer/index.js';
import { getConfig } from '../../../src/utils/config-loader.js';
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

// V2 test data generators
export const createV2TestProject = async () => {
  const { v4: uuidv4 } = await import('uuid');

  return {
    cad_trust_project_id: uuidv4(),
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
  const dataModelVersion = 'v1';
  const persistanceFolder = `${chiaRoot}/cadt/${dataModelVersion}`;
  const configFile = path.resolve(`${persistanceFolder}/config.yaml`);

  // Read current config
  let originalConfig = null;
  if (fs.existsSync(configFile)) {
    originalConfig = yaml.load(fs.readFileSync(configFile, 'utf8'));
  }

  try {
    // Clear memoize cache
    if (getConfig.cache) {
      getConfig.cache.clear();
    }

    // Load current config
    const currentConfig = getConfig();

    // Merge overrides
    const mergedConfig = JSON.parse(JSON.stringify(currentConfig)); // Deep clone
    Object.keys(configOverrides).forEach(key => {
      if (!mergedConfig[key]) {
        mergedConfig[key] = {};
      }
      Object.assign(mergedConfig[key], configOverrides[key]);
    });

    // Write modified config
    fs.writeFileSync(configFile, yaml.dump(mergedConfig), 'utf8');

    // Clear cache again to force reload
    if (getConfig.cache) {
      getConfig.cache.clear();
    }

    // Run the test
    return await testFn();
  } finally {
    // Restore original config
    if (originalConfig) {
      fs.writeFileSync(configFile, yaml.dump(originalConfig), 'utf8');
    } else if (fs.existsSync(configFile)) {
      // If there was no original, remove the test config
      fs.unlinkSync(configFile);
    }

    // Clear cache to reload original config
    if (getConfig.cache) {
      getConfig.cache.clear();
    }
  }
};
