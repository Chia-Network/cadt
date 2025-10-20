import { expect } from 'chai';
import { StagingV2, AuditV2 } from '../../../src/models/v2/index.js';

// V2 staging-specific fixtures
export const createV2StagingRecord = async (stagingData) => {
  const defaultData = {
    uuid: `v2-test-uuid-${Date.now()}`,
    table: 'test_table',
    action: 'INSERT',
    data: JSON.stringify([{ testField: 'testValue' }]),
    commited: false,
    failedCommit: false,
    isTransfer: false,
  };

  const record = await StagingV2.create({ ...defaultData, ...stagingData });
  return record;
};

export const validateV2StagingRecord = (record) => {
  const requiredFields = [
    'id',
    'uuid',
    'table',
    'action',
    'data',
    'commited',
    'failedCommit',
    'isTransfer',
    'created_at',
    'updated_at',
  ];

  requiredFields.forEach(field => {
    expect(record).to.have.property(field);
  });

  expect(record.uuid).to.be.a('string');
  expect(record.table).to.be.a('string');
  expect(record.action).to.be.oneOf(['INSERT', 'UPDATE', 'DELETE']);
  expect(record.data).to.be.a('string');
  expect(record.commited).to.be.a('boolean');
  expect(record.failedCommit).to.be.a('boolean');
  expect(record.isTransfer).to.be.a('boolean');
};

export const validateV2StagingData = (stagingRecord) => {
  const data = JSON.parse(stagingRecord.data);
  expect(data).to.be.an('array');
  expect(data.length).to.be.greaterThan(0);
  return data;
};

export const commitV2StagingRecord = async (uuid) => {
  await StagingV2.update(
    { commited: true },
    { where: { uuid } }
  );
};

export const failV2StagingRecord = async (uuid) => {
  await StagingV2.update(
    { failedCommit: true },
    { where: { uuid } }
  );
};

export const retryV2StagingRecord = async (uuid) => {
  await StagingV2.update(
    { commited: false, failedCommit: false },
    { where: { uuid } }
  );
};

// V2 staging query fixtures
export const getV2StagingByType = async (type) => {
  let where = {};

  switch (type) {
    case 'staged':
      where = { commited: false, failedCommit: false };
      break;
    case 'pending':
      where = { commited: true, failedCommit: false };
      break;
    case 'failed':
      where = { failedCommit: true };
      break;
    case 'transfer':
      where = { isTransfer: true };
      break;
  }

  return await StagingV2.findAll({ where });
};

export const getV2StagingByTable = async (tableName) => {
  return await StagingV2.findAll({
    where: { table: tableName },
  });
};

// V2 staging diff fixtures
export const validateV2StagingDiff = async (uuid) => {
  const stagingRecord = await StagingV2.findOne({
    where: { uuid },
    raw: true,
  });

  expect(stagingRecord).to.be.ok;

  // Mock diff object for testing
  const diff = {
    original: {},
    change: JSON.parse(stagingRecord.data),
  };

  expect(diff).to.be.an('object');
  expect(diff).to.have.property('original');
  expect(diff).to.have.property('change');

  return diff;
};

// V2 staging cleanup fixtures
export const cleanupV2StagingTable = async () => {
  await StagingV2.destroy({
    where: {},
    truncate: true,
  });
};

export const cleanupV2StagingByTable = async (tableName) => {
  await StagingV2.destroy({
    where: { table: tableName },
  });
};

// V2 staging batch operations
export const createV2StagingBatch = async (records) => {
  const stagingRecords = records.map((record, index) => ({
    uuid: `v2-batch-uuid-${Date.now()}-${index}`,
    table: record.table || 'test_table',
    action: record.action || 'INSERT',
    data: JSON.stringify(record.data || [{ testField: 'testValue' }]),
    commited: record.commited || false,
    failedCommit: record.failedCommit || false,
    isTransfer: record.isTransfer || false,
  }));

  return await StagingV2.bulkCreate(stagingRecords);
};

export const validateV2StagingBatch = async (expectedCount) => {
  const count = await StagingV2.count();
  expect(count).to.equal(expectedCount);
};

// V2 staging error scenarios
export const createV2StagingError = async (errorType) => {
  let stagingData = {
    uuid: `v2-error-uuid-${Date.now()}`,
    table: 'test_table',
    action: 'INSERT',
    data: JSON.stringify([{ testField: 'testValue' }]),
    commited: false,
    failedCommit: false,
    isTransfer: false,
  };

  switch (errorType) {
    case 'invalid_data':
      stagingData.data = 'invalid json';
      break;
    case 'invalid_action':
      stagingData.action = 'INVALID_ACTION';
      break;
    case 'missing_uuid':
      delete stagingData.uuid;
      break;
  }

  try {
    return await StagingV2.create(stagingData);
  } catch (error) {
    return { error: error.message };
  }
};

// V2 staging performance fixtures
export const measureV2StagingPerformance = async (operation) => {
  const startTime = Date.now();
  await operation();
  const endTime = Date.now();
  return endTime - startTime;
};

export const validateV2StagingPerformance = (executionTime, maxTime = 1000) => {
  expect(executionTime).to.be.lessThan(maxTime);
};
