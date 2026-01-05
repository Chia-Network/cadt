import { expect } from 'chai';
import supertest from 'supertest';
import app from '../../../src/server.js';
import { prepareV2Db } from '../../../src/database/v2/index.js';
import { AuditV2, OrganizationsV2 } from '../../../src/models/v2/index.js';
import { createV2TestHomeOrg } from '../utils/v2-test-helpers.js';

/**
 * Phase 17.2: AuditV2 Controller Read Endpoints Tests
 *
 * Tests for GET /v2/audit and GET /v2/audit/findConflicts endpoints
 */
describe('Phase 17.2: AuditV2 Controller Read Endpoints', function () {
  this.timeout(30000);

  let testOrgUid;

  before(async function () {
    console.log('Setting up V2 test environment...');
    await prepareV2Db();

    // Clean up any existing data
    await AuditV2.destroy({ where: {} });
    await OrganizationsV2.destroy({ where: {} });

    // Create test home organization
    const homeOrg = await createV2TestHomeOrg();
    testOrgUid = homeOrg.org_uid;
  });

  beforeEach(async function () {
    // Clean up audit records before each test
    await AuditV2.destroy({ where: {} });
  });

  describe('GET /v2/audit', function () {
    it('should return empty result when no audit records exist', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body).to.have.property('page', 1);
      expect(response.body).to.have.property('pageCount', 0);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array').that.is.empty;
    });

    it('should return audit records with pagination', async function () {
      // Create test audit records
      const now = Math.floor(Date.now() / 1000).toString();
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: now,
          generation: 1,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash2',
          type: 'update',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 1).toString(),
          generation: 2,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash3',
          type: 'delete',
          change: '{"test": "data3"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 2).toString(),
          generation: 3,
        },
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 2,
          order: 'DESC',
        })
        .expect(200);

      expect(response.body).to.have.property('page', 1);
      expect(response.body).to.have.property('pageCount', 2);
      expect(response.body.data).to.have.length(2);
      // Should be ordered DESC by timestamp
      expect(response.body.data[0].generation).to.equal(3);
      expect(response.body.data[1].generation).to.equal(2);
    });

    it('should return audit records ordered ASC', async function () {
      // Create test audit records
      const now = Math.floor(Date.now() / 1000).toString();
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: now,
          generation: 1,
        },
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash2',
          type: 'update',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 1).toString(),
          generation: 2,
        },
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
          order: 'ASC',
        })
        .expect(200);

      expect(response.body.data).to.have.length(2);
      // Should be ordered ASC by timestamp
      expect(response.body.data[0].generation).to.equal(1);
      expect(response.body.data[1].generation).to.equal(2);
    });

    it('should filter by orgUid', async function () {
      // Create another org
      const otherOrg = await OrganizationsV2.create({
        org_uid: 'other-org-uid',
        name: 'Other Org',
        registry_id: 'other-registry',
        is_home: false,
        subscribed: true,
      });

      const now = Math.floor(Date.now() / 1000).toString();
      await AuditV2.bulkCreate([
        {
          org_uid: testOrgUid,
          registry_id: 'test-registry-1',
          root_hash: 'hash1',
          type: 'insert',
          change: '{"test": "data1"}',
          table: 'project',
          onchain_confirmation_time_stamp: now,
          generation: 1,
        },
        {
          org_uid: otherOrg.org_uid,
          registry_id: 'other-registry',
          root_hash: 'hash2',
          type: 'insert',
          change: '{"test": "data2"}',
          table: 'project',
          onchain_confirmation_time_stamp: (parseInt(now) + 1).toString(),
          generation: 1,
        },
      ]);

      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0].org_uid).to.equal(testOrgUid);
    });

    it('should return error for invalid orgUid', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: 'invalid-org-uid',
          page: 1,
          limit: 10,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
      expect(response.body.message).to.include('Cannot retrieve audit data');
      expect(response.body.error).to.include('is not in the list of subscribed organizations');
    });

    it('should return error when page and limit are missing', async function () {
      const response = await supertest(app)
        .get('/v2/audit')
        .query({
          orgUid: testOrgUid,
        })
        .expect(400);

      expect(response.body.success).to.be.false;
    });
  });

  describe('GET /v2/audit/findConflicts', function () {
    it('should return empty array (placeholder implementation)', async function () {
      const response = await supertest(app)
        .get('/v2/audit/findConflicts')
        .query({
          orgUid: testOrgUid,
        })
        .expect(200);

      expect(response.body).to.be.an('array').that.is.empty;
    });

    it('should work without orgUid parameter', async function () {
      const response = await supertest(app)
        .get('/v2/audit/findConflicts')
        .expect(200);

      expect(response.body).to.be.an('array').that.is.empty;
    });
  });
});

