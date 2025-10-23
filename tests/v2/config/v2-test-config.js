// V2 Test Configuration
// This file contains V2-specific test configuration and utilities

export const V2_TEST_CONFIG = {
  // V2 Database Configuration
  database: {
    dialect: 'sqlite',
    storage: '~/.chia/mainnet/cadt/v2/data.sqlite3',
    logging: false, // Disable SQL logging in tests
  },

  // V2 Test Data Configuration
  testData: {
    homeOrgUid: 'test-home-org-v2',
    testOrgUid: 'test-org-v2',
    testRegistryId: 'test-registry-v2',
    testRegistryHash: 'test-hash-v2',
  },

  // V2 API Configuration
  api: {
    baseUrl: '/v2',
    timeout: 30000, // 30 seconds
  },

  // V2 Test Timeouts
  timeouts: {
    short: 5000,   // 5 seconds
    medium: 15000, // 15 seconds
    long: 30000,   // 30 seconds
  },

  // V2 Test Data Patterns
  patterns: {
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    snakeCase: /^[a-z][a-z0-9_]*$/,
    camelCase: /^[a-z][a-zA-Z0-9]*$/,
  },
};

// V2 Test Environment Setup
export const setupV2TestEnvironment = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.USE_SIMULATOR = 'true';

  // Import and prepare V2 database
  const { prepareV2Db } = await import('../../src/database/v2/index.js');
  await prepareV2Db();
};

// V2 Test Environment Cleanup
export const cleanupV2TestEnvironment = async () => {
  // Clean up any test-specific resources
  // This is called after each test suite
};

// V2 Test Data Generators
export const generateV2TestData = {
  uuid: () => {
    const { uuid: uuidv4 } = require('uuidv4');
    return uuidv4();
  },

  organization: (overrides = {}) => ({
    org_uid: generateV2TestData.uuid(),
    name: 'Test Organization V2',
    icon: 'test-icon',
    registry_id: 'test-registry',
    registry_hash: 'test-hash',
    subscribed: true,
    synced: true,
    file_store_subscribed: 'test-store',
    sync_remaining: 0,
    balance: '0',
    pending_balance: '0',
    is_home: false,
    metadata: '{}',
    data_model_version_store_id: 'test-store-id',
    data_model_version_store_hash: 'test-store-hash',
    ...overrides,
  }),

  staging: (overrides = {}) => ({
    uuid: generateV2TestData.uuid(),
    table: 'test_table',
    action: 'INSERT',
    data: JSON.stringify([{ test: 'data' }]),
    commited: false,
    failed_commit: false,
    is_transfer: false,
    ...overrides,
  }),

  meta: (overrides = {}) => ({
    meta_key: 'test_key',
    meta_value: 'test_value',
    ...overrides,
  }),

  governance: (overrides = {}) => ({
    meta_key: 'test_governance_key',
    meta_value: 'test_governance_value',
    confirmed: true,
    ...overrides,
  }),

  simulator: (overrides = {}) => ({
    key: 'test_simulator_key',
    value: 'test_simulator_value',
    ...overrides,
  }),
};

// V2 Test Assertions
export const V2Assertions = {
  isValidUuid: (value) => {
    return V2_TEST_CONFIG.patterns.uuid.test(value);
  },

  isSnakeCase: (value) => {
    return V2_TEST_CONFIG.patterns.snakeCase.test(value);
  },

  isCamelCase: (value) => {
    return V2_TEST_CONFIG.patterns.camelCase.test(value);
  },

  hasTimestampFields: (record) => {
    return record.hasOwnProperty('created_at') && record.hasOwnProperty('updated_at');
  },

  hasSnakeCaseFields: (record) => {
    const fields = Object.keys(record);
    return fields.every(field => V2Assertions.isSnakeCase(field));
  },
};

// V2 Test Utilities
export const V2TestUtils = {
  // Wait for V2 datalayer sync
  waitForV2Sync: (ms = 10000) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Reset V2 staging table
  resetV2Staging: async () => {
    const { StagingV2 } = await import('../../src/models/v2/index.js');
    await StagingV2.destroy({ where: {} });
  },

  // Create V2 test home org
  createV2HomeOrg: async () => {
    const { OrganizationsV2 } = await import('../../src/models/v2/index.js');
    return await OrganizationsV2.upsert(generateV2TestData.organization({
      org_uid: V2_TEST_CONFIG.testData.homeOrgUid,
      name: 'Test Home Organization V2',
      is_home: true,
    }));
  },

  // Get V2 table count
  getV2TableCount: async (tableName) => {
    const { sequelizeV2 } = await import('../../src/database/v2/index.js');
    const result = await sequelizeV2.query(
      `SELECT COUNT(*) as count FROM ${tableName}`,
      { type: sequelizeV2.QueryTypes.SELECT }
    );
    return result[0].count;
  },

  // Get V2 table schema
  getV2TableSchema: async (tableName) => {
    const { sequelizeV2 } = await import('../../src/database/v2/index.js');
    const result = await sequelizeV2.query(
      `PRAGMA table_info(${tableName})`,
      { type: sequelizeV2.QueryTypes.SELECT }
    );
    return result;
  },
};

export default V2_TEST_CONFIG;
