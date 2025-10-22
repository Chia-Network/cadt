import { expect } from 'chai';
import { StagingV2, AuditV2, OrganizationsV2, MetaV2, GovernanceV2 } from '../../../src/models/v2/index.js';
import datalayer from '../../../src/datalayer';
import { getV2Config } from '../../../src/utils/v2-config-loader';
import { Op } from 'sequelize';
import supertest from 'supertest';
import app from '../../../src/server';

const TEST_WAIT_TIME = datalayer.POLLING_INTERVAL * 2;

// Enhanced V2-specific test utilities
export const waitForV2DataLayerSync = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, TEST_WAIT_TIME * 5);
  });
};

// V2 staging table utilities
export const resetV2StagingTable = async () => {
  await StagingV2.destroy({
    where: {},
    truncate: true,
  });
};

export const getV2StagingRecordCount = async () => {
  return await StagingV2.count();
};

export const getLastV2StagingRecord = async () => {
  const record = await StagingV2.findOne({
    order: [['id', 'DESC']],
    raw: true,
  });
  return record;
};

// V2 organization utilities
export const createV2TestHomeOrg = async () => {
  const response = await supertest(app).post(`/v2/organizations`).send({
    name: 'V2 Test Organization',
    icon: 'v2-icon',
  });

  console.log('Creating V2 home org', response.body);

  return response.body.orgUid;
};

export const getV2HomeOrgId = async () => {
  const organizationResults = await supertest(app).get('/v2/organizations');
  return Object.keys(organizationResults.body).find(
    (key) => organizationResults.body[key].isHome,
  );
};

// V2 audit utilities
export const getV2AuditRecordCount = async () => {
  return await AuditV2.count();
};

export const createV2TestAuditRecord = async (orgUid = 'v2-test-org-001') => {
  const auditData = {
    orgUid,
    registryId: 'v2-registry-001',
    rootHash: 'v2-root-hash-001',
    type: 'INSERT',
    change: 'Test change',
    table: 'project',
    onchainConfirmationTimeStamp: new Date(),
    author: 'test-author',
    comment: 'Test audit record',
    generation: 1,
  };

  return await AuditV2.create(auditData);
};

// V2 metadata utilities
export const setV2MetaValue = async (key, value) => {
  await MetaV2.upsert({
    metaKey: key,
    metaValue: value,
  });
};

export const getV2MetaValue = async (key) => {
  const meta = await MetaV2.findOne({
    where: { metaKey: key },
    raw: true,
  });
  return meta?.metaValue;
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

export const validateV2PrimaryKey = (record, primaryKeyField) => {
  expect(record).to.have.property(primaryKeyField);
  expect(record[primaryKeyField]).to.be.ok;
  expect(record[primaryKeyField]).to.be.a('number');
};

// V2 foreign key validation
export const validateV2ForeignKey = (record, foreignKeyField, expectedValue) => {
  expect(record).to.have.property(foreignKeyField);
  expect(record[foreignKeyField]).to.equal(expectedValue);
};

// V2 staging diff validation
export const validateV2StagingDiff = (stagingRecord) => {
  expect(stagingRecord).to.have.property('diff');
  expect(stagingRecord.diff).to.be.an('object');
  expect(stagingRecord.diff).to.have.property('original');
  expect(stagingRecord.diff).to.have.property('change');
};

// V2 error response validation
export const validateV2ErrorResponse = (response, expectedMessage, expectedStatus = 400) => {
  expect(response.status).to.equal(expectedStatus);
  expect(response.body).to.have.property('message');
  expect(response.body).to.have.property('success', false);
  expect(response.body.message).to.include(expectedMessage);
};

// V2 success response validation
export const validateV2SuccessResponse = (response, expectedMessage, expectedStatus = 200) => {
  expect(response.status).to.equal(expectedStatus);
  expect(response.body).to.have.property('message');
  expect(response.body.message).to.include(expectedMessage);
};

// V2 pagination validation
export const validateV2Pagination = (response, expectedCount) => {
  expect(response.body).to.have.property('data');
  expect(response.body).to.have.property('pagination');
  expect(response.body.pagination).to.have.property('total', expectedCount);
  expect(response.body.pagination).to.have.property('page');
  expect(response.body.pagination).to.have.property('limit');
};

// V2 picklist validation helper
export const validateV2PicklistField = (record, fieldName, validValues) => {
  if (record[fieldName]) {
    expect(validValues).to.include(record[fieldName]);
  }
};

// V2 test data cleanup
export const cleanupV2TestData = async () => {
  await resetV2StagingTable();
  await AuditV2.destroy({ where: {}, truncate: true });
  await OrganizationsV2.destroy({ where: { orgUid: 'v2-test-org-001' } });
  await MetaV2.destroy({ where: { metaKey: { [Op.like]: 'v2-test-%' } } });
};

// V2 simulator mode detection
export const isV2SimulatorMode = () => {
  const config = getV2Config();
  return config?.USE_SIMULATOR || false;
};

// V2 test timeout helper
export const getV2TestTimeout = () => {
  return isV2SimulatorMode() ? TEST_WAIT_TIME * 10 : TEST_WAIT_TIME * 2;
};
