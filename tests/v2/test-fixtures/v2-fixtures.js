import { expect } from 'chai';
import {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  createV2TestProject,
  waitForV2DataLayerSync
} from '../utils/v2-test-helpers.js';

// V2 Organization fixtures
export const createV2TestOrganization = async (overrides = {}) => {
  const { OrganizationsV2 } = await import('../../../src/models/v2/index.js');
  const { v4: uuidv4 } = await import('uuid');

  const defaultOrg = {
    org_uid: uuidv4(),
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
  };

  const orgData = { ...defaultOrg, ...overrides };
  return await OrganizationsV2.create(orgData);
};

// V2 Staging fixtures
export const createV2StagingRecord = async (data) => {
  const { StagingV2 } = await import('../../../src/models/v2/index.js');
  const { v4: uuidv4 } = await import('uuid');

  return await StagingV2.create({
    uuid: uuidv4(),
    table: data.table || 'test_table',
    action: data.action || 'INSERT',
    data: JSON.stringify(data.records || []),
    commited: false,
    failed_commit: false,
    is_transfer: data.isTransfer || false,
  });
};

export const getV2LastCreatedStagingRecord = async () => {
  const { StagingV2 } = await import('../../../src/models/v2/index.js');

  const record = await StagingV2.findOne({
    order: [['created_at', 'DESC']],
    raw: true,
  });

  if (record) {
    record.diff = {
      original: {},
      change: JSON.parse(record.data),
    };
  }

  return record;
};

// V2 Meta fixtures
export const createV2MetaRecord = async (key, value) => {
  const { MetaV2 } = await import('../../../src/models/v2/index.js');

  return await MetaV2.upsert({
    meta_key: key,
    meta_value: value,
  });
};

export const getV2MetaValue = async (key) => {
  const { MetaV2 } = await import('../../../src/models/v2/index.js');

  const record = await MetaV2.findOne({
    where: { meta_key: key },
    raw: true,
  });

  return record?.meta_value;
};

// V2 Governance fixtures
export const createV2GovernanceRecord = async (key, value) => {
  const { GovernanceV2 } = await import('../../../src/models/v2/index.js');

  return await GovernanceV2.upsert({
    meta_key: key,
    meta_value: value,
    confirmed: true,
  });
};

// V2 Simulator fixtures
export const createV2SimulatorRecord = async (key, value) => {
  const { SimulatorV2 } = await import('../../../src/models/v2/index.js');

  return await SimulatorV2.upsert({
    key: key,
    value: value,
  });
};

// V2 Test setup utilities
export const setupV2TestEnvironment = async () => {
  await resetV2StagingTable();
  await createV2TestHomeOrg();
};

export const cleanupV2TestEnvironment = async () => {
  // Clean up all V2 tables
  const {
    StagingV2,
    OrganizationsV2,
    MetaV2,
    GovernanceV2,
    SimulatorV2
  } = await import('../../../src/models/v2/index.js');

  await Promise.all([
    StagingV2.destroy({ where: {} }),
    OrganizationsV2.destroy({ where: {} }),
    MetaV2.destroy({ where: {} }),
    GovernanceV2.destroy({ where: {} }),
    SimulatorV2.destroy({ where: {} }),
  ]);
};

// V2 Validation fixtures
export const validateV2StagingRecord = (record) => {
  expect(record).to.have.property('uuid');
  expect(record).to.have.property('table');
  expect(record).to.have.property('action');
  expect(record).to.have.property('data');
  expect(record).to.have.property('commited');
  expect(record).to.have.property('failed_commit');
  expect(record).to.have.property('is_transfer');
  expect(record).to.have.property('created_at');
  expect(record).to.have.property('updated_at');
};

export const validateV2OrganizationRecord = (record) => {
  expect(record).to.have.property('org_uid');
  expect(record).to.have.property('name');
  expect(record).to.have.property('subscribed');
  expect(record).to.have.property('synced');
  expect(record).to.have.property('is_home');
  expect(record).to.have.property('created_at');
  expect(record).to.have.property('updated_at');
};

// V2 API test fixtures
export const createV2TestPayload = (tableName, overrides = {}) => {
  const basePayloads = {
    staging: {
      table: 'test_table',
      action: 'INSERT',
      data: JSON.stringify([{ test: 'data' }]),
      commited: false,
      failed_commit: false,
      is_transfer: false,
    },
    organizations: {
      org_uid: 'test-org-v2',
      name: 'Test Organization V2',
      subscribed: true,
      synced: true,
      is_home: false,
    },
    meta: {
      meta_key: 'test_key',
      meta_value: 'test_value',
    },
    governance: {
      meta_key: 'test_governance_key',
      meta_value: 'test_governance_value',
      confirmed: true,
    },
    simulator: {
      key: 'test_simulator_key',
      value: 'test_simulator_value',
    },
  };

  return { ...basePayloads[tableName], ...overrides };
};

// V2 Database utilities
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

// Export all utilities
export {
  resetV2StagingTable,
  createV2TestHomeOrg,
  getV2HomeOrgId,
  createV2TestProject,
  waitForV2DataLayerSync,
};
